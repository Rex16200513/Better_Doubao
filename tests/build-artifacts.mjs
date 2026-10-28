import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

for (const browser of ['chrome', 'edge']) {
  const root = `${browser}/dist`;
  const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, 'utf8'));
  for (const script of manifest.content_scripts ?? []) {
    for (const path of [...(script.js ?? []), ...(script.css ?? [])]) {
      assert(existsSync(`${root}/${path}`), `${browser}: missing content script asset ${path}`);
    }
  }
  assert.equal(readFileSync(`${root}/src/assets/styles/content.css`, 'utf8'), readFileSync('src/assets/styles/content.css', 'utf8'));
}
console.log('PASS: Chrome and Edge content script assets exist and CSS matches source');
