import type { Video, ParsedCompactLine, FilmstripImage } from './type';

import { createPartialUrlReadFile } from './reader';

const jsFilePath = new URL('../output/ffmpeg.js', import.meta.url).href;
const wasmFilePath = new URL('../output/ffmpeg.wasm', import.meta.url).href;

const wasmFactoryPromise = import(jsFilePath).then((res) => res.default);
const wasmModulePromise = WebAssembly.compileStreaming(fetch(wasmFilePath));

const INPUT_FILE_PREFIX = 'input.';
const IN_MEMORY_OUTPUT_DIRECTORY = '/output';

async function getWasmInstance() {
  const [wasmFactory, wasmModule] = await Promise.all([
    wasmFactoryPromise,
    wasmModulePromise,
  ]);

  return new Promise<any>((resolve) => {
    const instance = wasmFactory({
      noFSInit: true,
      instantiateWasm: (imports: any, successCallback: Function) => {
        WebAssembly.instantiate(wasmModule, imports).then((wasmInstance) =>
          successCallback(wasmInstance, wasmModule),
        );
        return {};
      },
      onRuntimeInitialized: () => resolve(instance),
    });
  });
}

const CHAR_CODE_LINE_FEED = 10;
const CHAR_CODE_CARRIAGE_RETURN = 13;
function recordTraceChar(
  traceLines: string[],
  callback: (line: string) => void,
  charCode: number | null,
): void {
  if (typeof charCode === 'number') {
    if (
      charCode === CHAR_CODE_LINE_FEED ||
      charCode === CHAR_CODE_CARRIAGE_RETURN
    ) {
      if (traceLines.length > 0) {
        callback(traceLines.at(-1)!);
      }
      traceLines.push('');
    } else if (traceLines.length === 0) {
      traceLines[0] = String.fromCharCode(charCode);
    } else {
      traceLines[traceLines.length - 1] += String.fromCharCode(charCode);
    }
  }
}

function parseCompactLine(line: string): ParsedCompactLine {
  const [type, ...properties] = line.split('|');
  const parsed: ParsedCompactLine = { type, properties: {} };
  for (const prop of properties) {
    const [key, ...value] = prop.split('=');
    parsed.properties[key] = value.join('=');
  }
  return parsed;
}

function tryParseCompactFilmstripPacket(
  parsed: ParsedCompactLine,
): FilmstripImage | undefined {
  const { pos, size, pts_time } = parsed.properties;
  if (
    parsed.type !== 'packet' ||
    pts_time === undefined ||
    size === undefined ||
    pos === undefined
  ) {
    return undefined;
  }
  const byteOffset = Number.parseInt(pos);
  const sizeInBytes = Number.parseInt(size);
  const timeInSeconds = Number.parseFloat(pts_time);
  if (
    Number.isNaN(byteOffset) ||
    Number.isNaN(sizeInBytes) ||
    Number.isNaN(timeInSeconds)
  ) {
    return undefined;
  }
  return { byteOffset, sizeInBytes, timeInSeconds };
}

function isCompactFormatLine(parsed: ParsedCompactLine): boolean {
  return parsed.type === 'format';
}

function isCompactPacketLine(parsed: ParsedCompactLine): boolean {
  return parsed.type === 'packet';
}

async function generateFilmstrip(video: Video) {
  const ffmpeg = await getWasmInstance();

  const filmstripImages: FilmstripImage[] = [];
  const traceLines: string[] = [];
  const traceCallback = (line: string) => {
    const parsed = parseCompactLine(line);

    console.log(
      parsed.type,
      isCompactPacketLine(parsed) || isCompactFormatLine(parsed)
        ? parsed.properties
        : '',
    );

    const filmstripImage = tryParseCompactFilmstripPacket(parsed);
    if (filmstripImage !== undefined) {
      filmstripImages.push(filmstripImage);
    }
  };

  ffmpeg.FS.init(
    () => null,
    (charCode: number) => recordTraceChar(traceLines, traceCallback, charCode),
    (charCode: number) => recordTraceChar(traceLines, traceCallback, charCode),
  );

  const inputVideoNode = createUrlNode(
    INPUT_FILE_PREFIX +
      (INPUT_FILE_PREFIX.at(-1) === '.' ? '' : '.') +
      getExtension(video.name).toLowerCase(),
    video,
    ffmpeg.FS,
  );

  ffmpeg.FS.mkdir(IN_MEMORY_OUTPUT_DIRECTORY);

  const outputFilename = `${IN_MEMORY_OUTPUT_DIRECTORY}/filmstrip`;

  const programArguments = [
    'ffmpeg',
    // '-loglevel',
    // 'verbose',
    '-discard',
    'nokey', // Discards non-key packets, only decoding key-frames
    '-i',
    inputVideoNode.getFileName(),
    '-an', // Disable audio
    '-sn', // Disable subtitles
    '-map_chapters',
    '-1', // Do not map chapters
    '-vf',
    `scale=iw*sar:ih:fast_bilinear,scale=-1:52:fast_bilinear`,
    '-c:v',
    'mjpeg',
    '-pix_fmt',
    'yuvj420p',
    '-f',
    'mp4',
    '-fps_mode',
    'passthrough', // Don't try to detect framerate and use original timestamps
    '-y',
    outputFilename,
  ];

  console.log(programArguments.join(' '));

  try {
    const startTime = performance.now();
    const code = ffmpeg.Module.callMain(programArguments);

    if (code === 0) {
      console.log(
        'Filmstrip generation took',
        performance.now() - startTime,
        'ms',
      );

      await probePackets(ffmpeg, outputFilename);

      return {
        filmstripImages,
        url: URL.createObjectURL(
          new Blob([ffmpeg.FS.readFile(outputFilename)], { type: 'video/mp4' }),
        ),
      };
    } else {
      console.error('Filmstrip generation failed with code', code);
    }
  } catch (error: any) {
    console.error('Error calling ffmpeg:', error);
  }
}

function probePackets(ffmpeg: any, url: string) {
  const programArguments = [
    'ffprobe',
    '-print_format',
    'compact',
    '-show_packets',
    '-show_format',
    '-i',
    url,
  ];

  console.log(programArguments.join(' '));

  return new Promise<void>((resolve, reject) => {
    try {
      const startTime = performance.now();
      const code = ffmpeg.Module.callMain(programArguments);
      if (code === 0) {
        console.log('Probe took', performance.now() - startTime, 'ms');
        resolve();
      } else {
        console.error('Probe failed with code', code);
        reject();
      }
    } catch (error: any) {
      console.log('Error calling ffmpeg:', error);
      reject(error);
    }
  });
}

function getExtension(file: string, defaultValue?: string): string {
  const pos = file.lastIndexOf('.');
  if (pos >= 0) {
    return file.slice(Math.max(0, pos + 1));
  } else {
    return defaultValue || '';
  }
}

function createUrlNode(fileName: string, inputVideo: any, filesystem: any) {
  const lastSlash = fileName.lastIndexOf('/');
  let parentDirectory = '/';

  if (lastSlash >= 0) {
    parentDirectory = fileName.slice(0, Math.max(0, lastSlash)) + '/';
    fileName = fileName.slice(Math.max(0, lastSlash + 1));
  }

  return createPartialUrlReadFile(
    parentDirectory,
    fileName,
    filesystem,
    inputVideo.url,
    inputVideo.size,
    256 * 1024,
  );
}

self.addEventListener('message', (event) => {
  switch (event.data.command) {
    case 'thumbnail':
      console.log(
        `Worker received command: ${event.data.command}, but it's not implemented yet.`,
      );

      break;
    case 'filmstrip':
      generateFilmstrip(event.data.video)
        .then((data) => {
          self.postMessage(data);
        })
        .catch((error) => {
          console.error('Filmstrip generation failed:', error);
          self.postMessage(null);
        });
      break;
    default:
      console.error('Unknown command:', event.data.command);
      break;
  }
});
