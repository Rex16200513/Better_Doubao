import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

function load(path, require, globals = {}) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, require, console, ...globals };
  vm.runInNewContext(source, context);
  return context.exports;
}

const valid = { folders: [], folderContents: {}, starredMessages: {}, corpusBoard: [] };
for (const [label, records, remove] of [
  ['legacy only', {}, false],
  ['invalid extension state', { dvFolderData_user_alice: {} }, false],
  ['valid primary', { dvFolderData_user_alice: valid }, true],
  ['valid fallback', { dvFolderData_user_alice: {}, dvFolderBackup_user_alice: valid }, true],
]) {
  const page = new Map([['userInfo', '{"id":"alice"}'], ['dvFolderBackup_user_alice', 'legacy'], ['dvFolderBackup_user_bob', 'other']]);
  const browser = { storage: { local: { get: async () => records } } };
  const { StorageService } = load('src/core/services/StorageService.ts', () => ({ default: browser }), {
    localStorage: { getItem: key => page.get(key) ?? null, removeItem: key => page.delete(key) },
    sessionStorage: { getItem: () => null }, document: { cookie: '' },
  });
  const service = new StorageService();
  await service.init();
  assert.equal(page.has('dvFolderBackup_user_alice'), !remove, label);
  assert(page.has('dvFolderBackup_user_bob'), `${label}: preserve other account`);
}

for (const action of ['cancel', 'confirm', 'outside']) {
  const handlers = {}; let removed = false; let deleted = false;
  const popup = {
    style: {},
    querySelector: selector => ({ addEventListener: (_event, handler) => { handlers[selector] = handler; } }),
    addEventListener: (_event, handler) => { handlers.outside = handler; },
    remove: () => { removed = true; },
  };
  const storageService = { deleteFolder: async () => { deleted = true; }, getData: async () => valid };
  const { FolderManager } = load('src/features/folder/FolderManager.ts', name => name === '../../core' ? { storageService } : { escapeHTML: value => value }, {
    document: { createElement: () => popup, body: { appendChild() {} } },
  });
  const manager = new FolderManager();
  manager.render = () => {};
  manager.refreshAllIndicators = () => {};
  manager.showDeleteConfirm({ name: 'Example' }, 'folder');
  if (action === 'cancel') handlers['.dbx-popup-btn-cancel']();
  if (action === 'confirm') await handlers['.dbx-popup-btn-danger']();
  if (action === 'outside') handlers.outside({ target: popup });
  assert(removed, `${action}: popup removed`);
  assert.equal(deleted, action === 'confirm');
  assert.equal(manager.popupElement, null);
}
console.log('PASS: legacy recovery preservation, valid fallback, cancel/confirm/outside modal cleanup');
