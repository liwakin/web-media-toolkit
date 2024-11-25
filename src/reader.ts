import {
  DEFAULT_CACHE_SIZE_IN_BYTES,
  responseHeaderKeyMapping,
  HTTP_RANGE_NOT_SATISFIABLE,
  HTTP_SUCCESS_MIN,
  HTTP_SUCCESS_MAX,
  CONTENT_RANGE_REGEXP,
  FILE_CONSTANTS,
  BLOCKSIZE_IN_BYTES,
} from './constants';

export abstract class CachedReader {
  constructor(protected readonly cacheSize = DEFAULT_CACHE_SIZE_IN_BYTES) {}

  protected readCache?: {
    data: Uint8Array;
    offset: number;
  };

  protected canBeServedFromCache(
    fileOffset: number,
    numberOfBytes: number,
  ): boolean {
    return (
      this.readCache !== undefined &&
      fileOffset >= this.readCache.offset &&
      fileOffset + numberOfBytes <=
        this.readCache.offset + this.readCache.data.byteLength
    );
  }

  protected readFromCache(
    fileOffset: number,
    numberOfBytes: number,
    targetHeap: Uint8Array,
    heapOffset: number,
  ): number {
    if (this.readCache === undefined) {
      throw new Error(
        'Expected readCache to be defined when reading from cache',
      );
    }

    const startOffset = fileOffset - this.readCache.offset;
    const arraySlice = this.readCache.data.subarray(
      startOffset,
      startOffset + numberOfBytes,
    );

    targetHeap.set(arraySlice, heapOffset);

    return arraySlice.byteLength;
  }
}

export class UrlReader extends CachedReader {
  constructor(
    private readonly fileUrl: string,
    protected fileSize?: number,
    cacheSize?: number,
  ) {
    super(cacheSize);
  }

  protected determineFileSize(xhr: XMLHttpRequest): number {
    if (xhr.status === HTTP_RANGE_NOT_SATISFIABLE) {
      console.error(
        `Range 0...0 of ${this.fileUrl} is not satisfiable, file is empty`,
      );
      return 0;
    }
    if (xhr.status < HTTP_SUCCESS_MIN || xhr.status > HTTP_SUCCESS_MAX) {
      throw new Error(
        `Request failed with response: ${xhr.statusText} (${xhr.status})`,
      );
    }

    const header = xhr.getResponseHeader(
      responseHeaderKeyMapping.CONTENT_RANGE,
    );
    if (!header) {
      throw new Error('Response did not contain Content-Range header');
    }

    const match = CONTENT_RANGE_REGEXP.exec(header);
    if (!match) {
      throw new Error('Cannot determine file size');
    }

    return Number.parseInt(match[3]);
  }

  protected makeRequest(
    fileOffset: number,
    numberOfBytes: number,
  ): XMLHttpRequest {
    let endByte = fileOffset;
    if (numberOfBytes > 0) {
      endByte += Math.max(numberOfBytes, this.cacheSize) - 1;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('GET', this.fileUrl, false);
    xhr.overrideMimeType('application/octet-stream');
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('Range', `bytes=${fileOffset}-${endByte}`);

    try {
      xhr.send();
    } catch (error) {
      throw new Error(
        JSON.stringify({
          originalError:
            error instanceof DOMException ? error.message : String(error),
          fileUrl: this.fileUrl,
          byteRange: `${fileOffset}-${endByte}`,
        }),
      );
    }

    return xhr;
  }

  protected readFromRequest(
    xhr: XMLHttpRequest,
    fileOffset: number,
    numberOfBytes: number,
    targetHeap: Uint8Array,
    heapOffset: number,
  ): number {
    if (xhr.status === HTTP_RANGE_NOT_SATISFIABLE) {
      console.log(
        `Range ${fileOffset}...${fileOffset + numberOfBytes - 1} of ${
          this.fileUrl
        } is not satisfiable`,
      );
      return 0;
    }
    if (xhr.status < HTTP_SUCCESS_MIN || xhr.status > HTTP_SUCCESS_MAX) {
      throw new Error(
        `Request failed with response: ${xhr.statusText} (${xhr.status})`,
      );
    }

    const header = xhr.getResponseHeader(
      responseHeaderKeyMapping.CONTENT_RANGE,
    );
    if (!header) {
      throw new Error('Response did not contain Content-Range header');
    }

    const match = CONTENT_RANGE_REGEXP.exec(header);
    if (!match) {
      throw new Error(`Could not parse Content-Range header: ${header}`);
    }

    this.readCache = {
      offset: Number.parseInt(match[1]),
      data: new Uint8Array(xhr.response),
    };
    return this.readFromCache(
      fileOffset,
      numberOfBytes,
      targetHeap,
      heapOffset,
    );
  }
}

export class SyncUrlReader extends UrlReader {
  get size(): number {
    if (this.fileSize === undefined) {
      const xhr = this.makeRequest(0, 0);
      this.fileSize = this.determineFileSize(xhr);
    }
    return this.fileSize;
  }

  read(
    fileOffset: number,
    numberOfBytes: number,
    targetHeap: Uint8Array,
    heapOffset: number,
  ): number {
    if (this.canBeServedFromCache(fileOffset, numberOfBytes)) {
      return this.readFromCache(
        fileOffset,
        numberOfBytes,
        targetHeap,
        heapOffset,
      );
    } else {
      const xhr = this.makeRequest(fileOffset, numberOfBytes);
      return this.readFromRequest(
        xhr,
        fileOffset,
        numberOfBytes,
        targetHeap,
        heapOffset,
      );
    }
  }
}

export function createPartialUrlReadFile(
  parentDirectoryName: string,
  fileName: string,
  fileSystem: any,
  url: string,
  fileSize?: number,
  fileCacheSize?: number,
): any {
  const reader = new SyncUrlReader(url, fileSize, fileCacheSize);

  const node = fileSystem.createFile(
    parentDirectoryName,
    fileName,
    null,
    true,
    true,
  );

  node.node_ops = {
    getattr: (node: any) => {
      return {
        dev: 1, // FIXME: in mounted fileSystem, we would have a proper number here
        ino: node.id,
        mode: node.mode,
        nlink: 1,
        uid: 0,
        gid: 0,
        rdev: node.rdev,
        size: reader.size,
        atime: new Date(node.timestamp),
        mtime: new Date(node.timestamp),
        ctime: new Date(node.timestamp),
        blksize: BLOCKSIZE_IN_BYTES,
        blocks: Math.ceil(reader.size / BLOCKSIZE_IN_BYTES),
      };
    },
  };

  node.stream_ops = {
    llseek: (stream: any, fileOffset: number, whence: number) => {
      switch (whence) {
        case FILE_CONSTANTS.SEEK_SET:
          stream.position = fileOffset;
          break;
        case FILE_CONSTANTS.SEEK_CUR:
          stream.position += fileOffset;
          break;
        case FILE_CONSTANTS.SEEK_END:
          stream.position = reader.size + fileOffset;
          break;
        default:
          throw new fileSystem.ErrnoError(FILE_CONSTANTS.EINVAL);
      }

      return stream.position;
    },
    read: (
      _stream: any,
      heap: Uint8Array,
      heapOffset: number,
      numberOfBytes: number,
      fileOffset: number,
    ) => {
      return reader.read(fileOffset, numberOfBytes, heap, heapOffset);
    },
  };

  return {
    getFileName: () => `${parentDirectoryName}${fileName}`,
  };
}
