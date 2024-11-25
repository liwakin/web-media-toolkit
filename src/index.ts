import type { Video } from './type';

const worker = new Worker(new URL('worker.ts', import.meta.url).href, {
  type: 'module',
});

worker.onerror = (event) => {
  console.error('Worker error:', event);
};

async function call(command: 'thumbnail' | 'filmstrip', video: Video) {
  return new Promise((resolve, reject) => {
    // It's a bug to use the same worker for multiple commands, but it's a simple demo
    worker.onmessage = (event) => {
      if (!event.data) {
        reject(new Error(`Failed to execute command: ${command}`));
        return;
      }
      resolve(event.data);
    };
    worker.postMessage({ command, video });
  });
}

export async function generateThumbnail(video: Video) {
  throw new Error('Not implemented');
  return call('thumbnail', video);
}

export async function generateFilmstrip(video: Video) {
  return call('filmstrip', video);
}
