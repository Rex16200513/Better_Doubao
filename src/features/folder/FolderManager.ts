import {
  storageService,
  FOLDER_COLORS,
  getFolderColor,
  escapeHTML,
  showConfirmDialog,
  showToast,
  type Folder,
  type FolderData,
  type ConversationReference,
} from '../../core';
import { pageLifecycle } from '../../core/services/PageLifecycle';

interface DragPayload {
  conversationId: string;
  title: string;
  url: string;
  sourceFolderId?: string;
}

const FOLDER_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
const CHEVRON_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
const PLUS_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
const MORE_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>';
const CLOSE_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';

export class FolderManager {
  private data: FolderData = { folders: [], folderContents: {}, starredMessages: {}, corpusBoard: [] };
  private sectionEl: HTMLElement | null = null;
  private sectionCollapsed = false;
  private unsubscribeDom: (() => void) | null = null;
  private dragData: DragPayload | null = null;
  private activePopover: HTMLElement | null = null;
  private activeDialog: HTMLElement | null = null;
  private docClickHandler: ((e: MouseEvent) => void) | null = null;

  async init(): Promise<void> {
    if (this.unsubscribeDom) return;
    await storageService.init();
    this.data = await storageService.getData();
    this.sectionCollapsed = await storageService.getSectionCollapsed();

    this.docClickHandler = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (this.activePopover && !this.activePopover.contains(target) && !target?.closest('.dbx-chat-dot, .dbx-folder-menu-btn')) {
        this.closePopover();
      }
    };
    document.addEventListener('click', this.docClickHandler);

    this.unsubscribeDom = pageLifecycle.onDomChange(() => this.syncSidebar(), 140);
    this.syncSidebar();
  }

  destroy(): void {
    this.unsubscribeDom?.();
    this.unsubscribeDom = null;
    if (this.docClickHandler) {
      document.removeEventListener('click', this.docClickHandler);
      this.docClickHandler = null;
    }
    this.closePopover();
    this.closeDialog();
    this.sectionEl?.remove();
    this.sectionEl = null;
    document.querySelectorAll('.dbx-chat-dot').forEach(el => el.remove());
    document.querySelectorAll('.dbx-native-chat-icon-hidden').forEach(el => {
      el.classList.remove('dbx-native-chat-icon-hidden');
    });
  }

  private closePopover(): void {
    this.activePopover?.remove();
    this.activePopover = null;
  }

  private closeDialog(): void {
    this.activeDialog?.remove();
    this.activeDialog = null;
  }

  private syncSidebar(): void {
    const sidebar = document.querySelector<HTMLElement>('#flow_chat_sidebar');
    if (!sidebar) return;

    if (!this.sectionEl || !sidebar.contains(this.sectionEl)) {
      this.sectionEl = sidebar.querySelector<HTMLElement>('#dbx-folder-section') || this.createSection();
      this.placeSection(sidebar, this.sectionEl);
      this.renderFolders();
    } else {
      this.placeSection(sidebar, this.sectionEl);
    }

    this.decorateConversationList(sidebar);
  }

  private createSection(): HTMLElement {
    const section = document.createElement('div');
    section.id = 'dbx-folder-section';
    section.className = 'dbx-folder-section';
    section.innerHTML = `
      <div class="dbx-folder-header">
        <button type="button" class="dbx-folder-title-btn" title="展开/收起分类文件夹">
          <span class="dbx-folder-section-chevron">${CHEVRON_SVG}</span>
          <span class="dbx-folder-icon">${FOLDER_ICON_SVG}</span>
          <span class="dbx-folder-title">分类文件夹</span>
        </button>
        <button type="button" class="dbx-folder-add-btn" title="新建分类文件夹">${PLUS_SVG}</button>
      </div>
      <div class="dbx-folder-list"></div>
    `;

    section.querySelector('.dbx-folder-title-btn')?.addEventListener('click', () => {
      this.sectionCollapsed = !this.sectionCollapsed;
      storageService.setSectionCollapsed(this.sectionCollapsed);
      this.applySectionCollapseState();
    });

    section.querySelector('.dbx-folder-add-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openFolderDialog();
    });

    return section;
  }

  private placeSection(sidebar: HTMLElement, section: HTMLElement): void {
    // Prefer inserting directly above the "最近" section, or directly below "项目"
    const recentHeader = Array.from(sidebar.querySelectorAll<HTMLElement>('span, div, p'))
      .find((el) => el.childElementCount === 0 && el.textContent?.trim() === '最近' && !el.closest('#dbx-folder-section'));
    const recentSection = recentHeader?.closest<HTMLElement>('section') || recentHeader?.parentElement;
    if (recentSection?.parentElement && recentSection.parentElement !== sidebar) {
      if (section.parentElement !== recentSection.parentElement || section.nextElementSibling !== recentSection) {
        recentSection.parentElement.insertBefore(section, recentSection);
      }
      return;
    }

    const projectSection = Array.from(sidebar.querySelectorAll<HTMLElement>('[data-history-container] section'))
      .find((sec) => Array.from(sec.querySelectorAll<HTMLElement>('span')).some(s => s.textContent?.trim() === '项目'));
    if (projectSection?.parentElement) {
      if (section.parentElement !== projectSection.parentElement || section.previousElementSibling !== projectSection) {
        projectSection.parentElement.insertBefore(section, projectSection.nextSibling);
      }
      return;
    }

    const historyContainer = sidebar.querySelector<HTMLElement>('[data-history-container], [class*="history"]');
    if (historyContainer?.parentElement) {
      if (section.parentElement !== historyContainer.parentElement || section.nextElementSibling !== historyContainer) {
        historyContainer.parentElement.insertBefore(section, historyContainer);
      }
      return;
    }

    if (section.parentElement !== sidebar) {
      sidebar.appendChild(section);
    }
  }

  private applySectionCollapseState(): void {
    if (!this.sectionEl) return;
    this.sectionEl.classList.toggle('is-collapsed', this.sectionCollapsed);
  }

  private renderFolders(): void {
    if (!this.sectionEl) return;
    this.applySectionCollapseState();
    const listEl = this.sectionEl.querySelector<HTMLElement>('.dbx-folder-list');
    if (!listEl) return;

    listEl.replaceChildren();
    if (this.data.folders.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dbx-folder-empty';
      empty.textContent = '点右上角 + 新建分类，或点对话前圆点归类';
      listEl.appendChild(empty);
      return;
    }

    for (const folder of this.data.folders) {
      const contents = this.data.folderContents[folder.id] || [];
      const color = getFolderColor(folder.color);

      const item = document.createElement('div');
      item.className = `dbx-folder-item${folder.isExpanded ? ' is-expanded' : ''}`;
      item.dataset.folderId = folder.id;

      const row = document.createElement('div');
      row.className = 'dbx-folder-row';

      const chevron = document.createElement('span');
      chevron.className = 'dbx-folder-expand-icon';
      chevron.innerHTML = CHEVRON_SVG;

      const dot = document.createElement('span');
      dot.className = 'dbx-folder-color-dot';
      dot.style.backgroundColor = color;

      const nameEl = document.createElement('span');
      nameEl.className = 'dbx-folder-name';
      nameEl.textContent = folder.name;

      const countEl = document.createElement('span');
      countEl.className = 'dbx-folder-count';
      countEl.textContent = String(contents.length);

      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'dbx-folder-menu-btn';
      menuBtn.title = '重命名 / 改色 / 删除';
      menuBtn.innerHTML = MORE_SVG;
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openFolderMenu(folder, menuBtn);
      });

      row.append(chevron, dot, nameEl, countEl, menuBtn);
      row.addEventListener('click', () => {
        folder.isExpanded = !folder.isExpanded;
        void storageService.updateFolder(folder.id, { isExpanded: folder.isExpanded });
        this.renderFolders();
      });

      // Drop zone: drag any conversation from 最近 or another folder onto this folder row
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.classList.add('dbx-drop-target');
      });
      item.addEventListener('dragleave', (e) => {
        if (!item.contains(e.relatedTarget as Node | null)) {
          item.classList.remove('dbx-drop-target');
        }
      });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove('dbx-drop-target');
        void this.handleDropIntoFolder(folder.id, e);
      });

      const contentsEl = document.createElement('div');
      contentsEl.className = 'dbx-folder-contents';
      for (const conv of contents) {
        const convEl = document.createElement('div');
        convEl.className = 'dbx-folder-conversation';
        convEl.draggable = true;
        convEl.dataset.conversationId = conv.conversationId;

        const cDot = document.createElement('span');
        cDot.className = 'dbx-folder-conv-dot';
        cDot.style.backgroundColor = color;

        const titleEl = document.createElement('span');
        titleEl.className = 'dbx-conversation-title';
        titleEl.textContent = conv.title;
        titleEl.title = conv.title;

        const rmBtn = document.createElement('button');
        rmBtn.type = 'button';
        rmBtn.className = 'dbx-folder-conversation-remove';
        rmBtn.title = '移出文件夹';
        rmBtn.innerHTML = CLOSE_SVG;
        rmBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          void this.removeFromFolder(folder.id, conv.conversationId);
        });

        convEl.append(cDot, titleEl, rmBtn);
        convEl.addEventListener('click', () => this.openConversation(conv.conversationId, conv.url));
        convEl.addEventListener('dragstart', (e) => {
          this.dragData = {
            conversationId: conv.conversationId,
            title: conv.title,
            url: conv.url,
            sourceFolderId: folder.id,
          };
          e.dataTransfer?.setData('application/x-dbx-chat', JSON.stringify(this.dragData));
        });
        convEl.addEventListener('dragend', () => {
          this.dragData = null;
        });

        contentsEl.appendChild(convEl);
      }

      item.append(row, contentsEl);
      listEl.appendChild(item);
    }
  }

  private getConversationElements(sidebar: HTMLElement): HTMLElement[] {
    const raw = Array.from(sidebar.querySelectorAll<HTMLElement>(
      'a[id^="conversation_"], a[href^="/chat/"], [data-conversation-id]'
    )).filter(el => !el.closest('#dbx-folder-section, #dbx-sidebar-launcher-shell'));
    return Array.from(new Set(raw.map(el => el.closest<HTMLElement>('a[href^="/chat/"]') || el)));
  }

  private getConversationId(el: HTMLElement): string | undefined {
    const idMatch = el.id?.match(/conversation_([^/?#]+)/);
    if (idMatch) return idMatch[1];
    const dataId = el.dataset.conversationId || el.querySelector<HTMLElement>('[data-conversation-id]')?.dataset.conversationId;
    if (dataId) return dataId;
    return el.getAttribute('href')?.match(/\/chat\/([^/?#]+)/)?.[1];
  }

  private getConversationTitle(el: HTMLElement): string {
    return (el.textContent || '').replace(/\s+/g, ' ').trim() || '未命名对话';
  }

  private findFoldersForConversation(conversationId: string): Folder[] {
    const matched: Folder[] = [];
    for (const folder of this.data.folders) {
      const list = this.data.folderContents[folder.id];
      if (list?.some(c => c.conversationId === conversationId)) {
        matched.push(folder);
      }
    }
    return matched;
  }

  /**
   * Locate the native leading skeuomorphic chat icon (blue circle / speech bubble / laptop)
   * on the left side of a sidebar conversation row so we can replace it cleanly with our dot.
   */
  private findLeadingNativeIcon(row: HTMLElement): HTMLElement | null {
    const rowRect = row.getBoundingClientRect();
    if (rowRect.width < 40) return null;

    const media = Array.from(row.querySelectorAll<HTMLElement>('img, svg'))
      .filter(el => !el.closest('.dbx-chat-dot, [id^="dbx-"]'));

    for (const el of media) {
      const r = el.getBoundingClientRect();
      if (r.width >= 12 && r.width <= 34 && r.height >= 12 && r.height <= 34 && r.left - rowRect.left < 46) {
        let target: HTMLElement = el;
        const parent = el.parentElement;
        if (
          parent &&
          parent !== row &&
          parent.childElementCount === 1 &&
          !(parent.textContent || '').trim()
        ) {
          const pr = parent.getBoundingClientRect();
          if (pr.width <= 36 && pr.height <= 36) {
            target = parent;
          }
        }
        return target;
      }
    }
    return null;
  }

  private decorateConversationList(sidebar: HTMLElement): void {
    const rows = this.getConversationElements(sidebar);
    for (const row of rows) {
      const conversationId = this.getConversationId(row);
      if (!conversationId) continue;

      // Setup drag into folders (read conversationId dynamically in case Doubao recycles row nodes)
      if (row.dataset.dbxDragBound !== 'true') {
        row.dataset.dbxDragBound = 'true';
        row.draggable = true;
        row.addEventListener('dragstart', (e) => {
          const liveId = this.getConversationId(row);
          if (!liveId) return;
          const title = this.getConversationTitle(row);
          const url = row.getAttribute('href') || `/chat/${encodeURIComponent(liveId)}`;
          this.dragData = { conversationId: liveId, title, url };
          e.dataTransfer?.setData('application/x-dbx-chat', JSON.stringify(this.dragData));
        });
        row.addEventListener('dragend', () => {
          this.dragData = null;
        });
      }

      // Replace ugly native icon with sleek color-classification dot
      const matchedFolders = this.findFoldersForConversation(conversationId);
      const primaryFolder = matchedFolders[0] || null;
      const color = primaryFolder ? getFolderColor(primaryFolder.color) : '';

      let dot = row.querySelector<HTMLButtonElement>(':scope .dbx-chat-dot');
      if (!dot) {
        const nativeIcon = this.findLeadingNativeIcon(row);
        dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'dbx-chat-dot';
        dot.innerHTML = '<span class="dbx-chat-dot-core"></span>';
        dot.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const liveId = this.getConversationId(row);
          if (!liveId) return;
          this.openChatCategoryPopover(
            liveId,
            this.getConversationTitle(row),
            row.getAttribute('href') || `/chat/${encodeURIComponent(liveId)}`,
            dot!
          );
        });

        if (nativeIcon && nativeIcon.parentElement) {
          nativeIcon.classList.add('dbx-native-chat-icon-hidden');
          nativeIcon.parentElement.insertBefore(dot, nativeIcon);
        } else {
          row.insertBefore(dot, row.firstChild);
        }
      } else {
        // Ensure re-rendered native icon stays hidden
        const nativeIcon = this.findLeadingNativeIcon(row);
        if (nativeIcon) nativeIcon.classList.add('dbx-native-chat-icon-hidden');
      }

      const core = dot.querySelector<HTMLElement>('.dbx-chat-dot-core');
      if (primaryFolder && core) {
        dot.classList.add('is-assigned');
        core.style.backgroundColor = color;
        core.style.boxShadow = `0 0 0 3px ${color}29`;
        dot.title = `分类：${primaryFolder.name}（点击切换或移出）`;
      } else if (core) {
        dot.classList.remove('is-assigned');
        core.style.backgroundColor = '';
        core.style.boxShadow = '';
        dot.title = '未分类（点击设置颜色分类 / 加入文件夹）';
      }
    }
  }

  private openChatCategoryPopover(
    conversationId: string,
    title: string,
    url: string,
    anchor: HTMLElement
  ): void {
    this.closePopover();

    const pop = document.createElement('div');
    pop.id = 'dbx-chat-folder-popover';
    pop.className = 'dbx-chat-folder-popover';

    const head = document.createElement('div');
    head.className = 'dbx-cfp-head';
    head.textContent = '设置会话分类';
    pop.appendChild(head);

    const assignedIds = new Set(this.findFoldersForConversation(conversationId).map(f => f.id));

    if (this.data.folders.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'dbx-cfp-empty';
      hint.textContent = '还没有分类文件夹，点击下方新建';
      pop.appendChild(hint);
    } else {
      const list = document.createElement('div');
      list.className = 'dbx-cfp-list';
      for (const folder of this.data.folders) {
        const isIn = assignedIds.has(folder.id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `dbx-cfp-item${isIn ? ' is-selected' : ''}`;
        const dot = document.createElement('span');
        dot.className = 'dbx-folder-color-dot';
        dot.style.backgroundColor = getFolderColor(folder.color);
        const label = document.createElement('span');
        label.className = 'dbx-cfp-label';
        label.textContent = folder.name;
        const mark = document.createElement('span');
        mark.className = 'dbx-cfp-check';
        mark.textContent = isIn ? '✓' : '';
        btn.append(dot, label, mark);
        btn.addEventListener('click', () => void (async () => {
          if (isIn) {
            await this.removeFromFolder(folder.id, conversationId);
          } else {
            await this.assignToFolder(folder.id, {
              conversationId,
              title,
              url,
              addedAt: Date.now(),
            });
          }
          this.closePopover();
        })());
        list.appendChild(btn);
      }
      pop.appendChild(list);
    }

    const footer = document.createElement('div');
    footer.className = 'dbx-cfp-footer';
    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'dbx-cfp-create';
    createBtn.textContent = '+ 新建分类并加入';
    createBtn.addEventListener('click', () => {
      this.closePopover();
      this.openFolderDialog(undefined, { conversationId, title, url, addedAt: Date.now() });
    });
    footer.appendChild(createBtn);
    pop.appendChild(footer);

    document.body.appendChild(pop);
    this.activePopover = pop;
    this.positionPopover(pop, anchor);
  }

  private refreshSidebarDecorations(): void {
    const sidebar = document.querySelector<HTMLElement>('#flow_chat_sidebar');
    if (sidebar) this.decorateConversationList(sidebar);
  }

  private async refreshFoldersAndDecorations(): Promise<void> {
    this.data = await storageService.getData();
    this.renderFolders();
    this.refreshSidebarDecorations();
  }

  private openFolderMenu(folder: Folder, anchor: HTMLElement): void {
    this.closePopover();

    const menu = document.createElement('div');
    menu.className = 'dbx-chat-folder-popover dbx-folder-action-menu';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'dbx-cfp-item';
    editBtn.textContent = '重命名与修改颜色';
    editBtn.addEventListener('click', () => {
      this.closePopover();
      this.openFolderDialog(folder);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'dbx-cfp-item is-danger';
    delBtn.textContent = '删除文件夹';
    delBtn.addEventListener('click', () => void (async () => {
      this.closePopover();
      const ok = await showConfirmDialog({
        title: '删除分类文件夹',
        message: `确定删除「${folder.name}」吗？其中的对话记录不会被删除，仅解除分类归属。`,
        confirmText: '确认删除',
        danger: true,
      });
      if (!ok) return;
      await storageService.deleteFolder(folder.id);
      await this.refreshFoldersAndDecorations();
      showToast(`已删除分类「${folder.name}」`, 'info');
    })());

    menu.append(editBtn, delBtn);
    document.body.appendChild(menu);
    this.activePopover = menu;
    this.positionPopover(menu, anchor);
  }

  private positionPopover(pop: HTMLElement, anchor: HTMLElement): void {
    const aRect = anchor.getBoundingClientRect();
    const pRect = pop.getBoundingClientRect();
    const left = Math.min(window.innerWidth - pRect.width - 10, Math.max(10, aRect.right + 8));
    const top = Math.min(window.innerHeight - pRect.height - 10, Math.max(10, aRect.top - 4));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  private openFolderDialog(existing?: Folder, autoAssign?: ConversationReference): void {
    this.closeDialog();

    let selectedColor = existing?.color || 'blue';
    const overlay = document.createElement('div');
    overlay.className = 'dbx-popup';

    const card = document.createElement('div');
    card.className = 'dbx-popup-content';
    card.innerHTML = `
      <div class="dbx-popup-title">${existing ? '编辑分类文件夹' : '新建分类文件夹'}</div>
      <input type="text" class="dbx-popup-input" placeholder="输入分类名称（如：工作、代码、资料）" maxlength="24" value="${escapeHTML(existing?.name || '')}" />
      <div class="dbx-popup-color-label">选择颜色标识</div>
      <div class="dbx-popup-colors"></div>
      <div class="dbx-popup-actions">
        <button type="button" class="dbx-popup-btn dbx-popup-btn-cancel">取消</button>
        <button type="button" class="dbx-popup-btn dbx-popup-btn-confirm">${existing ? '保存' : '创建'}</button>
      </div>
    `;

    const input = card.querySelector<HTMLInputElement>('.dbx-popup-input')!;
    const colorsEl = card.querySelector<HTMLElement>('.dbx-popup-colors')!;

    for (const c of FOLDER_COLORS) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `dbx-color-option${selectedColor === c.id || selectedColor === c.value ? ' selected' : ''}`;
      swatch.style.backgroundColor = c.value;
      swatch.title = c.name;
      swatch.addEventListener('click', () => {
        selectedColor = c.id;
        colorsEl.querySelectorAll('.dbx-color-option').forEach(el => el.classList.remove('selected'));
        swatch.classList.add('selected');
      });
      colorsEl.appendChild(swatch);
    }

    const submit = async () => {
      const name = input.value.trim();
      if (!name) {
        showToast('请输入分类名称', 'warning');
        input.focus();
        return;
      }
      if (existing) {
        await storageService.updateFolder(existing.id, { name, color: selectedColor });
        showToast(`已更新分类「${name}」`, 'success');
      } else {
        const now = Date.now();
        const folder: Folder = {
          id: `folder_${now}_${Math.random().toString(36).slice(2, 7)}`,
          name,
          parentId: null,
          isExpanded: true,
          color: selectedColor,
          createdAt: now,
          updatedAt: now,
        };
        await storageService.addFolder(folder);
        if (autoAssign) {
          await storageService.addConversationToFolder(folder.id, autoAssign);
        }
        this.sectionCollapsed = false;
        storageService.setSectionCollapsed(false);
        showToast(autoAssign ? `已创建「${name}」并归类当前对话` : `已创建分类「${name}」`, 'success');
      }

      this.closeDialog();
      await this.refreshFoldersAndDecorations();
    };

    card.querySelector('.dbx-popup-btn-cancel')?.addEventListener('click', () => this.closeDialog());
    card.querySelector('.dbx-popup-btn-confirm')?.addEventListener('click', () => void submit());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) void submit();
      if (e.key === 'Escape') this.closeDialog();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeDialog();
    });

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    this.activeDialog = overlay;
    input.focus();
    input.select();
  }

  private async assignToFolder(folderId: string, conv: ConversationReference): Promise<void> {
    await storageService.addConversationToFolder(folderId, conv);
    await this.refreshFoldersAndDecorations();
  }

  private async removeFromFolder(folderId: string, conversationId: string): Promise<void> {
    await storageService.removeConversationFromFolder(folderId, conversationId);
    await this.refreshFoldersAndDecorations();
  }

  private async handleDropIntoFolder(targetFolderId: string, e: DragEvent): Promise<void> {
    let payload = this.dragData;
    if (!payload) {
      const raw = e.dataTransfer?.getData('application/x-dbx-chat');
      if (raw) {
        try { payload = JSON.parse(raw) as DragPayload; } catch { payload = null; }
      }
    }
    if (!payload?.conversationId) return;

    const conv: ConversationReference = {
      conversationId: payload.conversationId,
      title: payload.title,
      url: payload.url || `/chat/${payload.conversationId}`,
      addedAt: Date.now(),
    };

    if (payload.sourceFolderId && payload.sourceFolderId !== targetFolderId) {
      await storageService.moveConversationBetweenFolders(payload.sourceFolderId, targetFolderId, conv);
    } else {
      await storageService.addConversationToFolder(targetFolderId, conv);
    }

    this.data = await storageService.getData();
    const folder = this.data.folders.find(f => f.id === targetFolderId);
    if (folder) {
      folder.isExpanded = true;
      await storageService.updateFolder(folder.id, { isExpanded: true });
    }
    this.renderFolders();
    this.refreshSidebarDecorations();
    showToast(`已归类到「${folder?.name || '文件夹'}」`, 'success');
  }

  private openConversation(conversationId: string, url?: string): void {
    const sidebar = document.querySelector<HTMLElement>('#flow_chat_sidebar');
    if (sidebar) {
      const targetId = `conversation_${conversationId}`;
      const targetHref = `/chat/${conversationId}`;
      const existingLink = Array.from(sidebar.querySelectorAll<HTMLElement>('a[id], a[href]'))
        .find(el => el.id === targetId || el.getAttribute('href') === targetHref);
      if (existingLink) {
        existingLink.click();
        return;
      }
    }
    const isSafeRelativePath =
      typeof url === 'string' &&
      url.startsWith('/') &&
      !url.startsWith('//') &&
      !url.startsWith('/\\');
    const targetUrl = isSafeRelativePath ? url : `/chat/${encodeURIComponent(conversationId)}`;
    window.location.href = targetUrl;
  }
}

export const folderManager = new FolderManager();
