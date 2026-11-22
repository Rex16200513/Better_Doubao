import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

function loadTs(path, requireFn = () => ({}), globals = {}) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, require: requireFn, console, URL, ...globals };
  vm.runInNewContext(source, context);
  return context.exports;
}

// 1. Core DOM/URL utilities
const domUtils = loadTs('src/core/utils/dom.ts', () => ({}), {
  window: { location: { pathname: '/chat/conv_123?tab=1', origin: 'https://www.doubao.com' }, setTimeout },
});

assert.equal(domUtils.escapeHTML('<script>"a" & \'b\'</script>'), '&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;');
assert.equal(domUtils.getConversationId('/chat/abc-99?foo=1#bar'), 'abc-99');
assert.equal(domUtils.getConversationId('/'), 'unknown');
assert.equal(domUtils.sanitizeFilename('a/b\\c:d*e?"<f>|g'), 'a_b_c_d_e___f__g');
assert.equal(domUtils.sanitizeFilename('   ', 'fallback'), 'fallback');
assert.equal(domUtils.resolveUrl('//cdn.example.com/x.png', 'https://www.doubao.com'), 'https://cdn.example.com/x.png');
assert.equal(domUtils.resolveUrl('/api/image/1.png', 'https://www.doubao.com'), 'https://www.doubao.com/api/image/1.png');
assert.equal(domUtils.resolveUrl('https://a.com/b.png', 'https://www.doubao.com'), 'https://a.com/b.png');
assert.equal(domUtils.isSafeHttpUrl('https://www.doubao.com/a.png'), true);
assert.equal(domUtils.isSafeHttpUrl('/img/a.png'), true);
assert.equal(domUtils.isSafeHttpUrl('javascript:alert(1)'), false);
assert.equal(domUtils.isSafeHttpUrl('data:text/html,<script>alert(1)</script>'), false);

// 2. StorageService: per-conversation clearCorpusBoard, backup validation, restore/undo, legacy migration
{
  const store = {};
  const browser = {
    storage: {
      local: {
        get: async keys => {
          if (Array.isArray(keys)) {
            const out = {};
            for (const k of keys) if (k in store) out[k] = store[k];
            return out;
          }
          return keys ? { [keys]: store[keys] } : { ...store };
        },
        set: async items => { Object.assign(store, items); },
      },
    },
  };
  const legacyData = {
    folders: [{ id: 'f1', name: 'Work', parentId: null, isExpanded: false, color: 'blue', createdAt: 1, updatedAt: 1 }],
    folderContents: { f1: [{ conversationId: 'c1', title: 'Chat 1', url: '/chat/c1', addedAt: 1 }] },
    starredMessages: { c1: [0] },
    corpusBoard: [
      { id: 'item1', text: 'Alpha', conversationId: 'c1', conversationTitle: 'Chat 1', addedAt: 1 },
      { id: 'item2', text: 'Beta', conversationId: 'c2', conversationTitle: 'Chat 2', addedAt: 2 },
    ],
    textHighlights: [],
  };
  store['dvFolderData_cookie_uid_123456789012345'] = structuredClone(legacyData);

  const { StorageService } = loadTs('src/core/services/StorageService.ts', () => ({ default: browser }), {
    localStorage: { getItem: () => null, removeItem: () => {} },
    sessionStorage: { getItem: () => null },
    document: { cookie: 'uid=123456789012345' },
    window: { setTimeout: fn => { fn(); return 1; } },
    clearTimeout: () => {},
  });

  const service = new StorageService();
  await service.init();

  // Migrated from volatile cookie key to stable default key
  assert.equal((await service.getFolders()).length, 1);
  assert(store['dvFolderData_default'], 'migrated to stable default storage key');

  // clearCorpusBoard(conversationId) only clears target conversation
  await service.clearCorpusBoard('c1');
  const remaining = await service.getCorpusBoard();
  assert.deepEqual(remaining.map(i => i.id), ['item2']);

  // validateBackup rejects invalid format & prototype pollution keys
  assert.throws(() => service.validateBackup({ format: 'wrong', version: 1, data: legacyData }));
  assert.throws(() => service.validateBackup({
    format: 'better-doubao-backup',
    version: 1,
    data: {
      ...legacyData,
      folderContents: JSON.parse('{"__proto__":[]}'),
    },
  }));

  // restoreBackup + undoRestore round-trip
  const emptyBackup = {
    format: 'better-doubao-backup',
    version: 1,
    data: { folders: [], folderContents: {}, starredMessages: {}, corpusBoard: [], textHighlights: [] },
  };
  await service.restoreBackup(emptyBackup);
  assert.equal((await service.getFolders()).length, 0);
  await service.undoRestore();
  assert.equal((await service.getFolders()).length, 1);
}

// 3. LatexDownloader: delayed copy-text attribute is NOT permanently skipped
{
  const inserted = [];
  const formulaEl = {
    attrs: {},
    parentNode: {
      insertBefore(node) { inserted.push(node); },
      appendChild(node) { inserted.push(node); },
    },
    nextSibling: null,
    nextElementSibling: null,
    getAttribute(name) { return this.attrs[name] ?? null; },
    querySelector() { return null; },
  };
  const makeEl = () => ({
    className: '',
    innerHTML: '',
    style: {},
    title: '',
    children: [],
    addEventListener() {},
    appendChild(child) { this.children.push(child); },
  });
  const doc = {
    querySelectorAll(selector) {
      if (selector.includes('copy-text')) {
        return formulaEl.attrs['copy-text'] ? [formulaEl] : [];
      }
      return [];
    },
    createElement: makeEl,
  };
  const { LatexDownloader } = loadTs('src/features/latex/LatexDownloader.ts', () => domUtils, {
    document: doc,
    window: { setTimeout },
    clearTimeout,
  });

  const downloader = new LatexDownloader();
  // First pass before copy-text arrives: nothing inserted and element is not blacklisted
  downloader.processExistingFormulas();
  assert.equal(inserted.length, 0);

  // Attribute arrives asynchronously
  formulaEl.attrs['copy-text'] = '\\(E = mc^2\\)';
  downloader.processExistingFormulas();
  assert.equal(inserted.length, 1);

  // Subsequent pass does not duplicate buttons
  downloader.processExistingFormulas();
  assert.equal(inserted.length, 1);
}

// 4. ExportManager: Markdown table rows, relative image URLs, PDF HTML sanitization
{
  class FakeElement {
    constructor(tagName, attrs = {}, children = []) {
      this.nodeType = 1;
      this.tagName = tagName.toUpperCase();
      this.attrs = { ...attrs };
      this.childNodes = children;
      this.style = {};
      this.parentElement = null;
      this.className = attrs.class || '';
      for (const c of children) if (c) c.parentElement = this;
    }
    get attributes() {
      return Object.entries(this.attrs).map(([name, value]) => ({ name, value }));
    }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = value; }
    removeAttribute(name) { delete this.attrs[name]; }
    remove() {
      if (this.parentElement) {
        this.parentElement.childNodes = this.parentElement.childNodes.filter(c => c !== this);
      }
    }
    closest() { return null; }
    get textContent() {
      return this.childNodes.map(c => c.nodeType === 3 ? c.textContent : c.textContent).join('');
    }
    querySelectorAll(selector) {
      const results = [];
      const tags = selector.split(',').map(s => s.trim().toUpperCase());
      const walk = node => {
        for (const child of node.childNodes) {
          if (child.nodeType === 1) {
            if (tags.includes('*') || tags.includes(child.tagName)) results.push(child);
            walk(child);
          }
        }
      };
      walk(this);
      return results;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  }
  const textNode = text => ({ nodeType: 3, textContent: text });

  let nextRoot = null;
  const { ExportManager } = loadTs('src/features/export/ExportManager.ts', name => {
    if (name.includes('utils/dom')) return domUtils;
    if (name.includes('utils/ui')) return { showConfirmDialog: async () => true, showToast() {} };
    if (name.includes('PageLifecycle')) return { pageLifecycle: { onDomChange: () => () => {} } };
    return {};
  }, {
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    window: { location: { origin: 'https://www.doubao.com' } },
    document: {
      createElement() {
        return nextRoot;
      },
    },
  });
  const exporter = new ExportManager();

  // Test multi-row table & relative/base64 image conversion in htmlToMarkdown
  nextRoot = new FakeElement('div', {}, [
    new FakeElement('table', {}, [
      new FakeElement('tr', {}, [
        new FakeElement('th', {}, [textNode('Col1')]),
        new FakeElement('th', {}, [textNode('Col2')]),
      ]),
      new FakeElement('tr', {}, [
        new FakeElement('td', {}, [textNode('A|1')]),
        new FakeElement('td', {}, [textNode('B1')]),
      ]),
      new FakeElement('tr', {}, [
        new FakeElement('td', {}, [textNode('A2')]),
        new FakeElement('td', {}, [textNode('B2')]),
      ]),
    ]),
    new FakeElement('img', { src: '/assets/pic.png', alt: 'rel' }),
    new FakeElement('img', { src: '//cdn.doubao.com/p.png', alt: 'proto' }),
    new FakeElement('img', { src: 'data:image/png;base64,AAAA', alt: 'inline' }),
  ]);
  const md = exporter.htmlToMarkdown('ignored');
  assert(md.includes('| Col1 | Col2 |'), 'table header formatted');
  assert(md.includes('| A\\|1 | B1 |'), 'table row 1 has closing pipe and escaped pipe');
  assert(md.includes('| A2 | B2 |'), 'table row 2 has closing pipe');
  assert(md.includes('![rel](https://www.doubao.com/assets/pic.png)'), 'root-relative img resolved');
  assert(md.includes('![proto](https://cdn.doubao.com/p.png)'), 'protocol-relative img resolved');
  assert(!md.includes('base64'), 'base64 img filtered out');

  // Test PDF HTML sanitization strips scripts, event handlers, layout styles, empty divs, and standalone "表格" labels
  const scriptEl = new FakeElement('script', {}, [textNode('alert(1)')]);
  const evilLink = new FakeElement('a', { href: 'javascript:alert(1)', onclick: 'steal()', style: 'height: 800px', class: 'tall-box' }, [textNode('click')]);
  const tableLabel = new FakeElement('div', { class: 'table-header' }, [textNode('表格')]);
  const emptyWrapper = new FakeElement('div', { style: 'min-height: 400px' }, [textNode('   ')]);
  const relImg = new FakeElement('img', { src: '/img/ok.png', onerror: 'evil()' });
  nextRoot = new FakeElement('div', {}, [scriptEl, evilLink, tableLabel, emptyWrapper, relImg]);
  Object.defineProperty(nextRoot, 'innerHTML', {
    get() { return JSON.stringify(this.childNodes.map(c => ({ tag: c.tagName, attrs: c.attrs }))); },
    set() {},
  });
  const sanitized = JSON.parse(exporter.sanitizeHtmlForPdf('ignored'));
  assert.equal(sanitized.length, 2, 'script, standalone table label, and empty wrapper removed');
  assert.equal(sanitized[0].attrs.href, undefined, 'javascript: href stripped');
  assert.equal(sanitized[0].attrs.onclick, undefined, 'onclick handler stripped');
  assert.equal(sanitized[0].attrs.style, undefined, 'layout inline style stripped');
  assert.equal(sanitized[0].attrs.class, undefined, 'host class stripped');
  assert.equal(sanitized[1].attrs.onerror, undefined, 'onerror handler stripped');
  assert.equal(sanitized[1].attrs.src, 'https://www.doubao.com/img/ok.png', 'relative img src resolved cleanly');
}

// 5. ToolHub: Escape key only steals focus when a ToolHub/Corpus UI is actually open
{
  let focusCalls = 0;
  let menuOpen = false;
  let menuRemoved = false;
  const docListeners = {};
  const trigger = {
    dataset: {},
    setAttribute() {},
    addEventListener() {},
    focus() { focusCalls++; },
  };
  const { ToolHub } = loadTs('src/features/tools/ToolHub.ts', name => {
    if (name.includes('StorageService')) return { storageService: {} };
    if (name.includes('CorpusBoard')) return { corpusBoard: { closePanel() {} } };
    if (name.includes('utils/ui')) return { showConfirmDialog: async () => true, showToast() {} };
    return { default: { storage: { local: { get: async () => ({ dbxToolsGuideSeen: true }) } } } };
  }, {
    document: {
      getElementById(id) {
        if (id === 'dbx-corpus-trigger') return trigger;
        if (id === 'dbx-tools-menu' && menuOpen) return { remove() { menuRemoved = true; menuOpen = false; } };
        return null;
      },
      querySelector() { return null; },
      addEventListener(event, handler) { docListeners[event] = handler; },
    },
    window: { addEventListener() {} },
  });

  const hub = new ToolHub();
  hub.init();

  // Nothing open -> Escape must NOT steal focus
  docListeners.keydown({ key: 'Escape' });
  assert.equal(focusCalls, 0, 'Esc does not hijack focus when nothing is open');

  // Menu open -> Escape closes menu and restores focus to trigger
  menuOpen = true;
  docListeners.keydown({ key: 'Escape' });
  assert.equal(menuRemoved, true, 'Esc closes open tools menu');
  assert.equal(focusCalls, 1, 'Esc restores focus when closing tools menu');
}

// 6. SettingsService: defaults, partial updates, non-boolean sanitization, reset
{
  const store = {};
  const browser = {
    storage: {
      local: {
        get: async key => ({ [key]: store[key] }),
        set: async items => { Object.assign(store, items); },
      },
    },
  };
  const settingsTypes = loadTs('src/core/types/settings.ts');
  const { SettingsService, mergeSettings } = loadTs('src/core/services/SettingsService.ts', name => {
    if (name.includes('types/settings')) return settingsTypes;
    return { default: browser };
  });

  const merged = mergeSettings({ enableExport: false, autoIndexLongChat: 'bad-type' });
  assert.equal(merged.enableExport, false);
  assert.equal(merged.autoIndexLongChat, true, 'non-boolean falls back to default');
  assert.equal(merged.enableQuickLocator, true);

  const svc = new SettingsService();
  await svc.load();
  await svc.updateSettings({ enableLatexDownloader: false });
  assert.equal(svc.getSettings().enableLatexDownloader, false);
  assert.equal(store.dbxSettings.enableLatexDownloader, false);
  await svc.resetSettings();
  assert.equal(svc.getSettings().enableLatexDownloader, true);
}

// 7. StorageService: starredMeta persistence, removal & backup validation
{
  const store = {};
  const browser = {
    storage: {
      local: {
        get: async keys => (Array.isArray(keys) ? {} : { [keys]: store[keys] }),
        set: async items => { Object.assign(store, items); },
      },
    },
  };
  const { StorageService } = loadTs('src/core/services/StorageService.ts', () => ({ default: browser }), {
    localStorage: { getItem: () => null, removeItem: () => {} },
    sessionStorage: { getItem: () => null },
    document: { cookie: '' },
    window: { setTimeout: fn => { fn(); return 1; } },
    clearTimeout: () => {},
  });
  const svc = new StorageService();
  await svc.init();
  await svc.addStarredMessage('chat_1', 2, { messageId: 'msg_2', text: 'Important question' });
  const data = await svc.getData();
  assert.equal(data.starredMeta?.chat_1?.[2]?.text, 'Important question');

  const validated = svc.validateBackup({ format: 'better-doubao-backup', version: 1, data });
  assert.equal(validated.starredMeta?.chat_1?.[2]?.messageId, 'msg_2');

  assert.throws(() => svc.validateBackup({
    format: 'better-doubao-backup',
    version: 1,
    data: { ...data, starredMeta: { chat_1: { 0: { text: 123 } } } },
  }));

  await svc.removeStarredMessage('chat_1', 2);
  assert.equal((await svc.getData()).starredMeta?.chat_1?.[2], undefined);
}

// 8. TextHighlighter: createRangeFromTextOffsets handles text-node boundaries cleanly
{
  const nodes = [
    { data: 'Hello ' },
    { data: '' },
    { data: 'World' },
  ];
  let createdRange = null;
  const { TextHighlighter } = loadTs('src/features/corpusboard/TextHighlighter.ts', name => {
    if (name.includes('StorageService')) return { storageService: {} };
    if (name.includes('utils/dom')) return domUtils;
    return {};
  }, {
    NodeFilter: { SHOW_TEXT: 4 },
    document: {
      createTreeWalker() {
        let i = -1;
        return {
          get currentNode() { return nodes[i]; },
          nextNode() { i++; return i < nodes.length; },
        };
      },
      createRange() {
        createdRange = {
          setStart(node, offset) { this.startContainer = node; this.startOffset = offset; },
          setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; },
        };
        return createdRange;
      },
    },
  });

  const highlighter = new TextHighlighter();
  // Offset 6 is exact boundary between "Hello " (len 6), "" (len 0), and "World" (starts at 6)
  const range = highlighter.createRangeFromTextOffsets({}, 6, 11);
  assert.equal(range.startContainer, nodes[2], 'start lands at beginning of next non-empty text node');
  assert.equal(range.startOffset, 0);
  assert.equal(range.endContainer, nodes[2]);
  assert.equal(range.endOffset, 5);
}

// 9. PageLifecycle: SPA URL notifications & clean unsubscribe
{
  let currentHref = 'https://www.doubao.com/chat/a';
  const winListeners = {};
  const { PageLifecycle } = loadTs('src/core/services/PageLifecycle.ts', () => ({}), {
    window: {
      location: { get href() { return currentHref; } },
      addEventListener(evt, fn) { winListeners[evt] = fn; },
      removeEventListener(evt) { delete winListeners[evt]; },
      setInterval: () => 42,
      setTimeout,
    },
    clearInterval: () => {},
    clearTimeout,
    document: { body: null },
  });

  const lifecycle = new PageLifecycle();
  const seen = [];
  const off = lifecycle.onUrlChange(url => seen.push(url));
  currentHref = 'https://www.doubao.com/chat/b';
  winListeners.popstate();
  winListeners.popstate(); // duplicate URL should not re-fire
  assert.deepEqual(seen, ['https://www.doubao.com/chat/b']);
  off();
  assert.equal(winListeners.popstate, undefined, 'listeners cleaned up after last unsubscribe');
}

// 10. UI utils: showConfirmDialog Esc cancellation & confirm resolution
{
  const keyHandlers = new Set();
  const makeNode = () => {
    const handlers = {};
    return {
      className: '',
      textContent: '',
      style: {},
      children: [],
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
  const appended = [];
  const { showConfirmDialog } = loadTs('src/core/utils/ui.ts', () => ({}), {
    document: {
      createElement: makeNode,
      body: { appendChild(el) { appended.push(el); } },
      addEventListener(_ev, fn) { keyHandlers.add(fn); },
      removeEventListener(_ev, fn) { keyHandlers.delete(fn); },
    },
    window: { setTimeout },
  });

  const escPromise = showConfirmDialog({ title: 'Test', message: 'Proceed?' });
  for (const fn of Array.from(keyHandlers)) {
    fn({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
  }
  assert.equal(await escPromise, false, 'Escape resolves confirm dialog as false');
  assert.equal(keyHandlers.size, 0, 'Escape listener cleaned up');
}

console.log('PASS: dom utils, storage isolation & migration, settings, starredMeta, highlighter boundary, page lifecycle, confirm dialog, latex, export, toolhub');
