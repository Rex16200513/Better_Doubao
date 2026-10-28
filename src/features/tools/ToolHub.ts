import { storageService } from '../../core/services/StorageService';

const button = (label: string, action: () => void): HTMLButtonElement => {
  const el = document.createElement('button');
  el.textContent = label;
  el.type = 'button';
  el.addEventListener('click', action);
  return el;
};

export class ToolHub {
  private panel: HTMLElement | null = null;
  init(): void {
    const trigger = document.getElementById('dbx-corpus-trigger');
    if (!trigger || document.getElementById('dbx-tools-toggle')) return;
    const toggle = button('＋', () => this.toggle(toggle));
    toggle.id = 'dbx-tools-toggle';
    toggle.title = '搜索、重点与备份';
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-expanded', 'false');
    trigger.appendChild(toggle);
    toggle.addEventListener('mousedown', e => e.stopPropagation());
    toggle.addEventListener('click', e => e.stopPropagation());
  }

  private toggle(toggle: HTMLButtonElement): void {
    const old = document.getElementById('dbx-tools-menu');
    if (old) { old.remove(); toggle.setAttribute('aria-expanded', 'false'); return; }
    const menu = document.createElement('div');
    menu.id = 'dbx-tools-menu';
    const rect = toggle.getBoundingClientRect();
    menu.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    menu.style.top = `${Math.max(8, Math.min(window.innerHeight - 64, rect.top - 60))}px`;
    for (const [label, title, action] of [
      ['⌕', '对话搜索', () => this.search()],
      ['☆', '高亮与收藏', () => void this.saved()],
      ['⇩', '数据备份与恢复', () => this.backup()],
    ] as const) {
      const item = button(label, () => { menu.remove(); toggle.setAttribute('aria-expanded', 'false'); action(); });
      item.title = title; item.setAttribute('aria-label', title); menu.appendChild(item);
    }
    menu.addEventListener('keydown', e => { if (e.key === 'Escape') { menu.remove(); toggle.focus(); } });
    document.body.appendChild(menu); toggle.setAttribute('aria-expanded', 'true');
    (menu.firstElementChild as HTMLElement)?.focus();
  }

  private open(title: string): HTMLElement {
    this.panel?.remove();
    const panel = document.createElement('section'); panel.id = 'dbx-tools-panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', title);
    const heading = document.createElement('h3'); heading.textContent = title;
    panel.append(heading, button('关闭', () => { panel.remove(); this.panel = null; }));
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') panel.remove(); });
    document.body.appendChild(panel); this.panel = panel; return panel;
  }

  private messages(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-message-id]')).filter(el => !el.parentElement?.closest('[data-message-id]'));
  }

  private jump(node: HTMLElement): void {
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    node.classList.add('dbx-message-highlight');
    window.setTimeout(() => node.classList.remove('dbx-message-highlight'), 2000);
  }

  private search(): void {
    const panel = this.open('对话搜索');
    const input = document.createElement('input'); input.placeholder = '搜索当前已加载的消息'; input.setAttribute('aria-label', input.placeholder);
    const results = document.createElement('div'); const status = document.createElement('p');
    let hits: HTMLElement[] = []; let index = -1;
    const move = (step: number) => { if (hits.length) { index = (index + step + hits.length) % hits.length; this.jump(hits[index]); status.textContent = `${index + 1} / ${hits.length} 条匹配消息`; } };
    const refresh = () => {
      results.replaceChildren(); index = -1;
      const query = input.value.trim().toLocaleLowerCase();
      hits = query ? this.messages().filter(n => n.textContent?.toLocaleLowerCase().includes(query)) : [];
      status.textContent = `${hits.length} 条匹配消息 · 仅搜索已加载内容`;
      for (const hit of hits) results.appendChild(button((hit.textContent || '').trim().slice(0, 180), () => this.jump(hit)));
    };
    input.addEventListener('input', refresh);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') move(e.shiftKey ? -1 : 1); });
    panel.append(input, button('重新搜索', refresh), button('上一条', () => move(-1)), button('下一条', () => move(1)), status, results);
    refresh(); input.focus();
  }

  private async saved(): Promise<void> {
    const panel = this.open('高亮与收藏'); const data = await storageService.getData();
    const input = document.createElement('input'); input.placeholder = '筛选摘录或对话'; input.setAttribute('aria-label', input.placeholder);
    const list = document.createElement('div');
    const render = () => {
      list.replaceChildren(); const q = input.value.toLocaleLowerCase();
      const current = window.location.pathname.match(/\/chat\/([^/?#]+)/)?.[1];
      for (const item of data.textHighlights ?? []) {
        if (!`${item.text} ${item.conversationId}`.toLocaleLowerCase().includes(q)) continue;
        const row = button(`高亮 · ${item.text}`, () => {
          if (item.conversationId !== current) { window.location.href = `/chat/${encodeURIComponent(item.conversationId)}`; return; }
          const target = this.messages().find(n => item.messageId ? n.dataset.messageId === item.messageId : n.textContent?.includes(item.text));
          if (target) this.jump(target); else window.alert('原文尚未加载，摘录仍保存在此目录中。');
        }); row.style.borderLeft = '4px solid #eab308'; list.appendChild(row);
      }
      for (const [conversation, indexes] of Object.entries(data.starredMessages)) {
        for (const i of indexes) {
          const label = `收藏 · ${conversation} · 第 ${i + 1} 条用户消息`;
          if (!label.toLocaleLowerCase().includes(q)) continue;
          list.appendChild(button(label, () => {
            if (conversation !== current) { window.location.href = `/chat/${encodeURIComponent(conversation)}`; return; }
            const dot = document.querySelector<HTMLElement>(`.dbx-locator-dot[data-marker-index="${i}"]`);
            if (dot) dot.click(); else window.alert('该收藏尚未加载，请先滚动加载原文。');
          }));
        }
      }
      if (!list.childElementCount) list.textContent = '暂无匹配的高亮或收藏';
    };
    input.addEventListener('input', render); panel.append(input, list); render();
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
    })().catch(() => { status.textContent = '备份失败，请重试。'; })));
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.setAttribute('aria-label', '选择恢复文件');
    file.addEventListener('change', () => void (async () => {
      const selected = file.files?.[0]; if (!selected) return;
      if (selected.size > 10 * 1024 * 1024) throw new Error('文件不能超过 10 MB');
      const parsed = JSON.parse(await selected.text());
      const data = storageService.validateBackup(parsed);
      status.textContent = `预览：${data.folders.length} 个文件夹、${data.corpusBoard.length} 条语料、${data.textHighlights?.length ?? 0} 条高亮`;
      if (!window.confirm(`${status.textContent}。覆盖当前账号数据？`)) return;
      await storageService.restoreBackup(parsed); window.location.reload();
    })().catch(error => { status.textContent = `恢复失败：${error instanceof Error ? error.message : '文件无效'}`; }));
    panel.append(file, button('恢复上次覆盖前的数据', () => void (async () => {
      if (!window.confirm('恢复上次覆盖前的数据？当前数据将保存为新的恢复前副本。')) return;
      await storageService.undoRestore(); window.location.reload();
    })().catch(error => { status.textContent = error instanceof Error ? error.message : '恢复失败'; })), status);
  }
}

export const toolHub = new ToolHub();
