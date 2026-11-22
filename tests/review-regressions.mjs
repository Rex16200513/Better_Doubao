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
  const keyHandlers = new Set();
  const makeNode = () => {
    const handlers = {};
    return {
      className: '',
      textContent: '',
      style: {},
      children: [],
      removed: false,
      setAttribute() {},
      append(...items) { this.children.push(...items); },
      appendChild(item) { this.children.push(item); },
      addEventListener(ev, fn) { handlers[ev] = fn; },
      click() { handlers.click?.({ target: this }); },
      focus() {},
      remove() { this.removed = true; },
      _handlers: handlers,
    };
  };
  let overlay = null;
  const { showConfirmDialog } = load('src/core/utils/ui.ts', () => ({}), {
    document: {
      createElement: makeNode,
      body: { appendChild(el) { overlay = el; } },
      addEventListener(_ev, fn) { keyHandlers.add(fn); },
      removeEventListener(_ev, fn) { keyHandlers.delete(fn); },
    },
    window: { setTimeout },
  });

  const promise = showConfirmDialog({ title: '确认操作', message: '继续？', danger: true });
  const actions = overlay.children[0].children[2];
  const [cancelBtn, confirmBtn] = actions.children;
  if (action === 'cancel') cancelBtn.click();
  if (action === 'confirm') confirmBtn.click();
  if (action === 'outside') overlay._handlers.click({ target: overlay });

  const result = await promise;
  assert.equal(overlay.removed, true, `${action}: modal removed`);
  assert.equal(result, action === 'confirm', `${action}: resolved value`);
  assert.equal(keyHandlers.size, 0, `${action}: Esc listener cleaned up`);
}
console.log('PASS: legacy recovery preservation, valid fallback, cancel/confirm/outside modal cleanup');
