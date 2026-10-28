import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import fs from 'fs';

const projectRoot = resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(resolve(projectRoot, 'chrome/manifest.json'), 'utf-8'));

export default defineConfig({
  plugins: [
    {
      name: 'emit-content-stylesheet',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'src/assets/styles/content.css',
          source: fs.readFileSync(resolve(projectRoot, 'src/assets/styles/content.css')),
        });
      },
    },
    crx({
      manifest,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, './src'),
    },
  },
  build: {
    outDir: resolve(projectRoot, 'chrome/dist'),
    emptyOutDir: true,
  },
});
