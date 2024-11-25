export interface Video {
  url: string;
  size: number;
  name: string;
}

export interface ParsedCompactLine {
  type: string;
  properties: { [key: string]: string | undefined };
}

export type FilmstripImage = {
  byteOffset: number;
  sizeInBytes: number;
  timeInSeconds: number;
};
