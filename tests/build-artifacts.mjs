import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

function findManifestFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      findManifestFiles(full, acc);
    } else if (entry.name === 'manifest.json') {
      acc.push(full);
    }
  }
  return acc;
}

for (const browser of ['chrome', 'edge']) {
  const root = `${browser}/dist`;
  assert(!existsSync(`${root}/.vite`), `${browser}: .vite directory must be stripped before packaging`);
  const manifests = findManifestFiles(root);
  assert.deepEqual(manifests, [`${root}/manifest.json`], `${browser}: package must contain exactly one root manifest.json`);

  const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, 'utf8'));
  assert(manifest.name && manifest.name.length <= 45, `${browser}: manifest.name must be <= 45 chars`);
  assert(manifest.description && manifest.description.length <= 132, `${browser}: manifest.description must be <= 132 chars (got ${manifest.description?.length})`);
  for (const script of manifest.content_scripts ?? []) {
    for (const path of [...(script.js ?? []), ...(script.css ?? [])]) {
      assert(existsSync(`${root}/${path}`), `${browser}: missing content script asset ${path}`);
    }
  }
  assert.equal(readFileSync(`${root}/src/assets/styles/content.css`, 'utf8'), readFileSync('src/assets/styles/content.css', 'utf8'));
}
console.log('PASS: Chrome and Edge content script assets exist, CSS matches source, and single root manifest.json verified');
