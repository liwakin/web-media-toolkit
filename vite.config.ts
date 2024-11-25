import { defineConfig } from 'vite';

export default defineConfig({
  base: './',

  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'web-media-toolkit',
      formats: ['es'],
    },

    assetsDir: '.',

    rollupOptions: {
      external: [],
      output: {},
    },
  },
});
