import { storageService } from '../../core/services/StorageService';
import { showConfirmDialog, showToast } from '../../core/utils/ui';
import { corpusBoard } from '../corpusboard/CorpusBoard';
import { layoutStudioModal } from '../workspace/LayoutStudioModal';
import browser from 'webextension-polyfill';

const HIGHLIGHT_SWATCHES = [
  { color: '#FDEB00', name: '黄色' },
  { color: '#00E52B', name: '绿色' },
  { color: '#09DCE5', name: '青色' },
  { color: '#F000C8', name: '粉色' },
  { color: '#FF1616', name: '红色' },
  { color: '#747A89', name: '灰色' },
];

const CLOSE_ICON_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

const icons = [
  '<path d="M8 3h8l4 4v14H4V3h4m6 0v6h6M8 13h8M8 17h6"/>',
  '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9Z"/>',
  '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
];

const button = (label: string, action: () => void): HTMLButtonElement => {
  const el = document.createElement('button');
  el.textContent = label;
  el.type = 'button';
  el.addEventListener('click', event => { event.stopPropagation(); action(); });
  return el;
};

export class ToolHub {
  private panel: HTMLElement | null = null;
  init(): void {
    const trigger = document.getElementById('dbx-corpus-trigger');
    if (!trigger || trigger.dataset.toolsBound) return;
    trigger.dataset.toolsBound = 'true';
    trigger.title = 'Better Doubao 工具栏'; trigger.setAttribute('role', 'button'); trigger.tabIndex = 0;
    trigger.setAttribute('aria-label', 'Better Doubao 工具栏'); trigger.setAttribute('aria-expanded', 'false');
    document.addEventListener('dbx-toggle-tools', () => this.toggle(trigger));
    trigger.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(trigger); } });
    document.addEventListener('pointerdown', e => {
      if (!(e.target as Element).closest('#dbx-tools-menu, #dbx-corpus-trigger')) {
        document.getElementById('dbx-tools-menu')?.remove(); trigger.setAttribute('aria-expanded', 'false');
      }
    });
    window.addEventListener('resize', () => this.position());
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const menu = document.getElementById('dbx-tools-menu');
      const corpusPanel = document.querySelector('.dbx-corpus-panel');
      if (!menu && !this.panel && !corpusPanel) return;
      menu?.remove();
      this.panel?.remove();
      this.panel = null;
      corpusBoard.closePanel();
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    });
    void browser.storage.local.get('dbxToolsGuideSeen').then(saved => { if (!saved.dbxToolsGuideSeen) this.guide(); });
  }

  private toggle(toggle: HTMLElement): void {
    const old = document.getElementById('dbx-tools-menu');
    if (old) { old.remove(); toggle.setAttribute('aria-expanded', 'false'); return; }
    const menu = document.createElement('div');
    menu.id = 'dbx-tools-menu';
    const rect = toggle.getBoundingClientRect();
    menu.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    menu.style.top = `${Math.max(8, Math.min(window.innerHeight - 64, rect.top - 60))}px`;
    for (const [label, title, action] of [
      ['▤', '语料板', () => { this.panel?.remove(); corpusBoard.openPanel(); this.styleCorpus(); }],
      ['⌕', '对话搜索', () => this.search()],
      ['☆', '高亮与收藏', () => void this.saved()],
      ['⚙', '界面与按钮定制', () => this.customize()],
      ['⇩', '数据备份与恢复', () => this.backup()],
    ] as const) {
      const item = button(label, () => { menu.remove(); toggle.setAttribute('aria-expanded', 'false'); action(); });
      item.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[menu.children.length]}</svg>`;
      item.title = title; item.dataset.tooltip = title; item.setAttribute('aria-label', title); menu.appendChild(item);
    }
    menu.addEventListener('keydown', e => { if (e.key === 'Escape') { menu.remove(); toggle.focus(); } });
    document.body.appendChild(menu); toggle.setAttribute('aria-expanded', 'true');
    (menu.firstElementChild as HTMLElement)?.focus();
  }

  private open(title: string): HTMLElement {
    corpusBoard.closePanel();
    this.panel?.remove();
    const panel = document.createElement('section'); panel.id = 'dbx-tools-panel';
    panel.className = 'dbx-unified-panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', title);
    const heading = document.createElement('h3'); heading.textContent = title;
    const header = document.createElement('header'); header.className = 'dbx-tool-header';
    this.draggable(panel);
    const close = button('', () => { panel.remove(); this.panel = null; document.getElementById('dbx-corpus-trigger')?.focus(); });
    close.className = 'dbx-panel-close';
    close.innerHTML = CLOSE_ICON_SVG;
    close.title = '关闭'; close.setAttribute('aria-label', '关闭');
    header.append(heading, close);
    const body = document.createElement('div');
    body.className = 'dbx-tool-body';
    panel.append(header, body);
    panel.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        panel.remove();
        if (this.panel === panel) this.panel = null;
      }
    });
    document.body.appendChild(panel); this.panel = panel; this.position(); return body;
  }

  private position(): void {
    const anchor = document.getElementById('dbx-corpus-trigger')?.getBoundingClientRect();
    for (const panel of [this.panel, document.querySelector<HTMLElement>('.dbx-corpus-panel')]) {
      if (!panel || !anchor) continue;
      const width = Math.min(316, window.innerWidth - 24);
      panel.style.width = `${width}px`;
      if (panel.dataset.dragged === 'true') {
        panel.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, panel.offsetLeft))}px`;
        panel.style.top = `${Math.max(12, Math.min(window.innerHeight - panel.offsetHeight - 12, panel.offsetTop))}px`;
        continue;
      }
      panel.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, anchor.left - width - 12))}px`;
      const height = Math.min(480, window.innerHeight - 24);
      panel.style.maxHeight = `${height}px`;
      panel.style.top = `${Math.max(12, Math.min(window.innerHeight - height - 12, anchor.top))}px`;
      panel.style.right = 'auto';
    }
  }

  private styleCorpus(): void {
    const panel = document.querySelector<HTMLElement>('.dbx-corpus-panel');
    if (!panel) return;
    panel.classList.add('dbx-unified-panel');
    this.draggable(panel);
    this.position();
  }

  private draggable(panel: HTMLElement): void {
    if (panel.dataset.dragBound === 'true') return;
    panel.dataset.dragBound = 'true';
    panel.addEventListener('pointerdown', event => {
      const target = event.target as Element;
      if (event.button !== 0 || !target.closest('.dbx-tool-header, .dbx-corpus-header') || target.closest('button, input')) return;
      event.preventDefault();
      const rect = panel.getBoundingClientRect();
      const dx = event.clientX - rect.left; const dy = event.clientY - rect.top;
      panel.setPointerCapture(event.pointerId);
      const move = (e: PointerEvent) => {
        panel.dataset.dragged = 'true'; panel.style.right = 'auto';
        panel.style.left = `${Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, e.clientX - dx))}px`;
        panel.style.top = `${Math.max(8, Math.min(window.innerHeight - panel.offsetHeight - 8, e.clientY - dy))}px`;
      };
      const end = () => { panel.removeEventListener('pointermove', move); panel.removeEventListener('pointerup', end); panel.removeEventListener('pointercancel', end); };
      panel.addEventListener('pointermove', move); panel.addEventListener('pointerup', end); panel.addEventListener('pointercancel', end);
    });
  }

  private guide(): void {
    const body = this.open('欢迎使用 Better Doubao');
    const p = document.createElement('p'); p.textContent = '点击悬浮按钮即可展开 Better Doubao 工具栏（语料板、对话搜索、高亮与收藏、数据备份）。可拖动标题栏调整位置，点击关闭按钮或按 Esc 收起。搜索仅覆盖已加载内容。';
    const startBtn = button('开始使用', () => {
      void browser.storage.local.set({ dbxToolsGuideSeen: true });
      this.panel?.remove();
      this.panel = null;
    });
    startBtn.className = 'dbx-tool-primary-btn';
    body.append(p, startBtn);
  }

  private messages(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-message-id]')).filter(el => !el.parentElement?.closest('[data-message-id]'));
  }

  private search(): void {
    const panel = this.open('对话搜索');
    const input = document.createElement('input'); input.placeholder = '搜索当前已加载的消息'; input.setAttribute('aria-label', input.placeholder);
    const results = document.createElement('div'); const status = document.createElement('p');
    let hits: { node: HTMLElement; text: string; range: Range }[] = []; let index = -1;
    const activate = (i: number) => {
      index = i; const hit = hits[i];
      if (!hit?.node.isConnected) { status.textContent = '原文已卸载，请重新搜索'; return; }
      if (!hit.range.getClientRects().length) { status.textContent = '命中文字当前不可见，请重新搜索'; return; }
      // Scroll using the text range rectangle, never the paragraph rectangle.
      let parent = hit.range.startContainer.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight) {
          const rect = hit.range.getBoundingClientRect(); const box = parent.getBoundingClientRect();
          parent.scrollTop += rect.top + rect.height / 2 - box.top - parent.clientHeight / 2;
        }
        parent = parent.parentElement;
      }
      const rect = hit.range.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) window.scrollBy({ top: rect.top + rect.height / 2 - window.innerHeight / 2, behavior: 'instant' });
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(hit.range);
      status.textContent = `${i + 1} / ${hits.length} 处匹配`;
    };
    const move = (step: number) => { if (hits.length) activate(index < 0 ? (step > 0 ? 0 : hits.length - 1) : (index + step + hits.length) % hits.length); };
    const refresh = () => {
      results.replaceChildren(); index = -1;
      const query = input.value.trim().toLocaleLowerCase();
      hits = [];
      if (query) for (const node of this.messages()) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const parts: { node: Text; start: number }[] = []; let text = ''; let next: Node | null;
        while ((next = walker.nextNode())) {
          if (next.parentElement?.closest('button,script,style,[aria-hidden="true"]')) continue;
          parts.push({ node: next as Text, start: text.length }); text += next.textContent;
        }
        const lower = text.toLocaleLowerCase(); let offset = 0;
        while ((offset = lower.indexOf(query, offset)) !== -1) {
          const begin = [...parts].reverse().find(p => p.start <= offset);
          const end = [...parts].reverse().find(p => p.start < offset + query.length);
          if (!begin || !end) break;
          const range = document.createRange(); range.setStart(begin.node, offset - begin.start); range.setEnd(end.node, offset + query.length - end.start);
          const before = text.slice(Math.max(0, offset - 24), offset).split(/[。！？.!?\n]/).pop() || '';
          const after = text.slice(offset + query.length, offset + query.length + 36).split(/[。！？.!?\n]/)[0];
          if (range.getClientRects().length) hits.push({ node, range, text: `${offset > before.length ? '…' : ''}${before}${text.slice(offset, offset + query.length)}${after}…`.trim() });
          offset += query.length;
        }
      }
      status.textContent = `${hits.length} 处匹配 · 仅搜索已加载内容`;
      hits.forEach((hit, i) => results.appendChild(button(hit.text, () => activate(i))));
    };
    input.addEventListener('input', refresh);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') move(e.shiftKey ? -1 : 1); });
    const actions = document.createElement('nav'); actions.className = 'dbx-tool-actions';
    actions.append(button('刷新结果', refresh), button('上一处', () => move(-1)), button('下一处', () => move(1)));
    results.className = 'dbx-tool-results'; panel.append(input, actions, status, results);
    refresh(); input.focus();
  }

  private async saved(): Promise<void> {
    const panel = this.open('高亮与收藏');
    const input = document.createElement('input');
    input.placeholder = '筛选摘录或对话';
    input.setAttribute('aria-label', input.placeholder);

    let activeColor: string | null = null;
    const filterBar = document.createElement('div');
    filterBar.className = 'dbx-color-filters';

    const list = document.createElement('div');
    list.className = 'dbx-saved-list';

    const unwrapMarksById = (highlightId: string) => {
      document.querySelectorAll<HTMLElement>('.dbx-text-highlight').forEach((mark) => {
        if (mark.dataset.dbxHighlightId !== highlightId) return;
        const parent = mark.parentNode;
        if (!parent) return;
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        mark.remove();
        parent.normalize();
      });
    };

    const renderFilters = () => {
      filterBar.replaceChildren();
      const allChip = button('全部', () => { activeColor = null; renderFilters(); void render(); });
      allChip.className = `dbx-color-filter-chip${activeColor === null ? ' is-active' : ''}`;
      filterBar.appendChild(allChip);

      for (const swatch of HIGHLIGHT_SWATCHES) {
        const chip = button('', () => {
          activeColor = activeColor?.toLowerCase() === swatch.color.toLowerCase() ? null : swatch.color;
          renderFilters();
          void render();
        });
        chip.className = `dbx-color-filter-chip dbx-color-filter-swatch${activeColor?.toLowerCase() === swatch.color.toLowerCase() ? ' is-active' : ''}`;
        chip.title = `按${swatch.name}筛选`;
        chip.setAttribute('aria-label', `按${swatch.name}筛选`);
        const dot = document.createElement('span');
        dot.className = 'dbx-highlight-color-dot';
        dot.style.backgroundColor = swatch.color;
        dot.style.marginRight = '0';
        chip.appendChild(dot);
        filterBar.appendChild(chip);
      }
    };

    const render = async () => {
      const data = await storageService.getData();
      list.replaceChildren();
      const q = input.value.trim().toLocaleLowerCase();
      const current = window.location.pathname.match(/\/chat\/([^/?#]+)/)?.[1];

      for (const item of data.textHighlights ?? []) {
        const normalizedColor = /^#[\da-fA-F]{3}([\da-fA-F]{3})?$/.test(item.color) ? item.color : '#FDEB00';
        if (activeColor) {
          const isYellowLegacy = activeColor.toLowerCase() === '#fdeb00' && normalizedColor.toLowerCase() === '#fde047';
          if (normalizedColor.toLowerCase() !== activeColor.toLowerCase() && !isYellowLegacy) continue;
        }
        if (q && !`${item.text} ${item.conversationId}`.toLocaleLowerCase().includes(q)) continue;

        const rowWrap = document.createElement('div');
        rowWrap.className = 'dbx-saved-row';
        rowWrap.style.borderLeft = `4px solid ${normalizedColor}`;

        const row = button(`高亮 · ${item.text}`, () => {
          if (item.conversationId !== current) { window.location.href = `/chat/${encodeURIComponent(item.conversationId)}`; return; }
          const marks = Array.from(document.querySelectorAll<HTMLElement>('.dbx-text-highlight')).filter(mark => mark.dataset.dbxHighlightId === item.id);
          const target = marks[0];
          if (target) {
            target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
            for (const mark of marks) mark.classList.add('dbx-highlight-located');
            window.setTimeout(() => marks.forEach(mark => mark.classList.remove('dbx-highlight-located')), 1800);
          } else {
            showToast('该高亮尚未加载，请先滚动加载原文；摘录仍保存在目录中。', 'info');
          }
        });
        row.className = 'dbx-saved-row-main';

        const dot = document.createElement('span');
        dot.className = 'dbx-highlight-color-dot';
        dot.style.backgroundColor = normalizedColor;
        dot.setAttribute('aria-label', `高亮颜色 ${normalizedColor}`);
        row.prepend(dot);

        const removeBtn = button('×', () => void (async () => {
          await storageService.removeTextHighlight(item.id);
          unwrapMarksById(item.id);
          showToast('已删除该高亮', 'success');
          await render();
        })());
        removeBtn.className = 'dbx-saved-delete';
        removeBtn.title = '删除高亮';
        removeBtn.setAttribute('aria-label', '删除高亮');

        rowWrap.append(row, removeBtn);
        list.appendChild(rowWrap);
      }

      if (!activeColor) {
        for (const [conversation, indexes] of Object.entries(data.starredMessages)) {
          for (const i of indexes) {
            const excerpt = data.starredMeta?.[conversation]?.[i]?.text;
            const label = excerpt
              ? `收藏 · ${excerpt}`
              : `收藏 · ${conversation} · 第 ${i + 1} 条用户消息`;
            if (q && !`${label} ${conversation}`.toLocaleLowerCase().includes(q)) continue;

            const rowWrap = document.createElement('div');
            rowWrap.className = 'dbx-saved-row';

            const row = button(label, () => {
              if (conversation !== current) { window.location.href = `/chat/${encodeURIComponent(conversation)}`; return; }
              const meta = data.starredMeta?.[conversation]?.[i];
              const messages = this.messages();
              let target: HTMLElement | undefined;
              if (meta?.messageId) {
                target = messages.find(el => el.dataset.messageId === meta.messageId);
              }
              if (!target && excerpt) {
                const probe = excerpt.replace(/…$/, '').slice(0, 24);
                target = messages.find(el => (el.textContent || '').includes(probe));
              }
              if (!target) {
                const nativeCard = document.querySelector<HTMLElement>(`[data-dbx-native-card="${i}"]`);
                if (nativeCard) { nativeCard.click(); return; }
              }
              if (target) {
                target.scrollIntoView({ block: 'center', behavior: 'smooth' });
                target.classList.add('dbx-message-highlight');
                window.setTimeout(() => target?.classList.remove('dbx-message-highlight'), 1800);
              } else {
                showToast('该收藏尚未加载，请先通过豆包定位滚动加载原文。', 'info');
              }
            });
            row.className = 'dbx-saved-row-main';

            const removeBtn = button('×', () => void (async () => {
              await storageService.removeStarredMessage(conversation, i);
              if (conversation === current) {
                document.dispatchEvent(new CustomEvent('dbx-starred-changed'));
              }
              showToast('已取消收藏', 'success');
              await render();
            })());
            removeBtn.className = 'dbx-saved-delete';
            removeBtn.title = '取消收藏';
            removeBtn.setAttribute('aria-label', '取消收藏');

            rowWrap.append(row, removeBtn);
            list.appendChild(rowWrap);
          }
        }
      }

      if (!list.childElementCount) {
        const empty = document.createElement('p');
        empty.textContent = '暂无匹配的高亮或收藏';
        list.appendChild(empty);
      }
    };

    input.addEventListener('input', () => void render());
    renderFilters();
    panel.append(input, filterBar, list);
    await render();
  }

  private customize(): void {
    corpusBoard.closePanel();
    this.panel?.remove();
    this.panel = null;
    layoutStudioModal.open();
  }

  private backup(): void {
    const panel = this.open('数据备份与恢复');
    const note = document.createElement('p'); note.textContent = '备份当前账号的文件夹、语料、高亮和收藏。恢复将覆盖当前数据，并保存恢复前副本。';
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    panel.append(note, button('下载 JSON 备份', () => void (async () => {
      await storageService.save();
      const content = JSON.stringify({ format: 'better-doubao-backup', version: 1, exportedAt: new Date().toISOString(), data: await storageService.getData() }, null, 2);
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `better-doubao-${Date.now()}.json`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('已导出 JSON 备份文件', 'success');
    })().catch(() => { status.textContent = '备份失败，请重试。'; })));
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.setAttribute('aria-label', '选择恢复文件');
    file.addEventListener('change', () => void (async () => {
      const selected = file.files?.[0]; if (!selected) return;
      if (selected.size > 10 * 1024 * 1024) throw new Error('文件不能超过 10 MB');
      const parsed = JSON.parse(await selected.text());
      const data = storageService.validateBackup(parsed);
      status.textContent = `预览：${data.folders.length} 个文件夹、${data.corpusBoard.length} 条语料、${data.textHighlights?.length ?? 0} 条高亮`;
      const confirmed = await showConfirmDialog({
        title: '确认覆盖恢复',
        message: `${status.textContent}。确认覆盖当前账号数据？（恢复前会自动保存一份回退副本）`,
        confirmText: '确认恢复',
        danger: true,
      });
      if (!confirmed) return;
      await storageService.restoreBackup(parsed); window.location.reload();
    })().catch(error => { status.textContent = `恢复失败：${error instanceof Error ? error.message : '文件无效'}`; }));
    panel.append(file, button('恢复上次覆盖前的数据', () => void (async () => {
      const confirmed = await showConfirmDialog({
        title: '回退上次恢复',
        message: '恢复上次覆盖前的数据？当前数据将保存为新的恢复前副本。',
        confirmText: '确认回退',
      });
      if (!confirmed) return;
      await storageService.undoRestore(); window.location.reload();
    })().catch(error => { status.textContent = error instanceof Error ? error.message : '恢复失败'; })), status);
  }
}

export const toolHub = new ToolHub();
