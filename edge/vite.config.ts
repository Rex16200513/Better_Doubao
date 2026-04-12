import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import fs from 'fs';

const projectRoot = resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(resolve(projectRoot, 'edge/manifest.json'), 'utf-8'));

const iconsDir = resolve(projectRoot, 'edge/dist/icons');
fs.mkdirSync(iconsDir, { recursive: true });
['16', '19', '38', '48', '128'].forEach(size => {
  const src = resolve(projectRoot, `public/icons/icon${size}.png`);
  const dest = resolve(iconsDir, `icon${size}.png`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
});

export default defineConfig({
  plugins: [
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
    outDir: resolve(projectRoot, 'edge/dist'),
    emptyOutDir: true,
  },
});
