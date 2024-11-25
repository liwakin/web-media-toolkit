import { generateFilmstrip } from 'web-media-toolkit';

import { preload } from './preload';

preload('/mov_bbb.mp4', 'preload', 'fetch', 'video/mp4');
preload('/test.mp4', 'preload', 'fetch', 'video/mp4');

const video_mov_bbb = {
  url: '/mov_bbb.mp4',
  size: 788493,
  name: 'mov_bbb.mp4',
};

const video_test = {
  url: '/test.mp4',
  size: 38906181,
  name: 'test.mp4',
};

const filmstripButtonMovBbb = document.querySelector<HTMLButtonElement>(
  '#filmstrip-button-mov_bbb',
)!;
const filmstripButtonTest = document.querySelector<HTMLButtonElement>(
  '#filmstrip-button-test',
)!;

// because the worker does not implement concurrent logic,
// we need to prevent multiple clicks
let running = false;
filmstripButtonMovBbb.onclick = () => {
  if (running) {
    return;
  }
  running = true;
  _generateFilmstrip(video_mov_bbb).finally(() => (running = false));
};
filmstripButtonTest.onclick = () => {
  if (running) {
    return;
  }
  running = true;
  _generateFilmstrip(video_test).finally(() => (running = false));
};

async function _generateFilmstrip(video) {
  const startTime = performance.now();
  const { filmstripImages, url } = await generateFilmstrip(video);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const tileHeight = (canvas!.height = 52);
  const tileWidth = tileHeight * (16 / 9);
  canvas!.width = tileWidth * filmstripImages.length;

  const filmstripPromises = filmstripImages.map(
    ({ byteOffset, sizeInBytes }, index) => {
      return fetch(url, {
        headers: {
          range: `bytes=${byteOffset}-${byteOffset + sizeInBytes}`,
        },
      })
        .then((response) => response.blob())
        .then((blob) => {
          const img = new Image();
          img.src = URL.createObjectURL(blob);
          img.onload = () => {
            ctx.drawImage(img, index * tileWidth, 0, tileWidth, tileHeight);
          };
        })
        .catch((err) => {
          console.error(err);
        });
    },
  );

  return Promise.all(filmstripPromises).then(() => {
    document.body.appendChild(canvas);

    const log = document.createElement('p');
    log.textContent = `filmstrip generated and drawn in ${performance.now() - startTime}ms`;
    document.body.appendChild(log);
  });
}
