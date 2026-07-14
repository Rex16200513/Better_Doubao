import { storageService, type Folder, type FolderData, type ConversationReference, getFolderColor } from '../../core';
import { createFolderItemHTML, createEmptyFolderHTML, createFolderSectionHTML, setupDropZone, setupDraggable, createIndicator, escapeHTML } from './ui';

interface DragData {
  type: string;
  conversationId?: string;
  title: string;
  sourceFolderId?: string;
}

export class FolderManager {
  private data: FolderData = { folders: [], folderContents: {}, starredMessages: {}, corpusBoard: [] };
  private containerElement: HTMLElement | null = null;
  private sidebarContainer: HTMLElement | null = null;
  private popupElement: HTMLElement | null = null;
  private dragData: DragData | null = null;
  private initialized = false;
  private sectionCollapsed = false;

  constructor() {
    this.init = this.init.bind(this);
    this.render = this.render.bind(this);
  }

  async init(): Promise<void> {
    await storageService.init();
    this.data = await storageService.getData();
    this.sectionCollapsed = await storageService.getSectionCollapsed();
    console.log('[FolderManager] Loaded data, folders:', this.data.folders.length);
    this.data.folders.forEach(f => f.isExpanded = false);
    await this.waitForSidebar();
    console.log('[FolderManager] Sidebar ready, creating folder section');
    this.findSidebarContainer();
    this.setupObservers();
    
    if (this.containerElement) {
      console.log('[FolderManager] Container exists, rendering');
      this.render();
    } else {
      console.log('[FolderManager] Container not found!');
    }
    
    this.addConversationIndicators();
    this.setupFolderDropZones();
    this.initialized = true;
  }

  private waitForSidebar(): Promise<void> {
    return new Promise((resolve) => {
      const checkSidebar = () => {
        const sidebar = document.querySelector('#flow_chat_sidebar');
        if (sidebar) {
          resolve();
          return true;
        }
        return false;
      };

      if (checkSidebar()) return;

      let retries = 0;
      const maxRetries = 100;

      const checkInterval = setInterval(() => {
        if (checkSidebar() || retries >= maxRetries) {
          clearInterval(checkInterval);
          if (retries >= maxRetries) {
            console.warn('[FolderManager] Sidebar not found after max retries');
          }
          resolve();
        }
        retries++;
      }, 250);
    });
  }

  private findSidebarContainer(): void {
    this.sidebarContainer = document.querySelector('#flow_chat_sidebar') as HTMLElement;
    if (this.sidebarContainer) {
      this.containerElement = this.sidebarContainer.querySelector('#dbx-folder-section') as HTMLElement;
      if (!this.containerElement) {
        this.createFolderSection();
      } else {
        this.setupFolderEvents();
      }
    }
  }

  private findMoreButtonContainer(): HTMLElement | null {
    if (!this.sidebarContainer) return null;

    const spans = this.sidebarContainer.querySelectorAll('span.font-medium');
    for (const span of Array.from(spans)) {
      if (span.textContent?.trim() === '更多') {
        // 排除我们自己 folder section 内部的 span
        if ((span as HTMLElement).closest('#dbx-folder-section')) continue;

        // 新版 DOM 中"更多"项外层是 <div data-expand="false">
        const itemContainer = span.closest('div[data-expand="false"]') as HTMLElement | null;
        if (itemContainer) return itemContainer;

        // 回退：nav-link 的直接父元素
        const navLink = span.closest('.nav-link-IkIer0') as HTMLElement | null;
        if (navLink?.parentElement) return navLink.parentElement as HTMLElement;

        return navLink;
      }
    }
    return null;
  }

  private createFolderSection(): void {
    if (!this.sidebarContainer) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = createFolderSectionHTML();
    const folderSection = tempDiv.firstElementChild as HTMLElement;

    // 查找"更多"按钮并贴在它下方
    const moreContainer = this.findMoreButtonContainer();
    if (moreContainer?.parentNode) {
      moreContainer.parentNode.insertBefore(folderSection, moreContainer.nextSibling);
    } else {
      // 查找历史对话区域
      const historySection = this.sidebarContainer.querySelector('[class*="history"]');
      if (historySection && historySection.parentNode) {
        historySection.parentNode.insertBefore(folderSection, historySection.nextSibling);
      } else {
        // 查找用户信息区域（底部），在它之前插入
        const userSection = this.sidebarContainer.querySelector('[class*="-mx-12"]');
        if (userSection && userSection.parentNode) {
          userSection.parentNode.insertBefore(folderSection, userSection);
        } else {
          // 最后在侧边栏末尾添加
          this.sidebarContainer.appendChild(folderSection);
        }
      }
    }

    this.containerElement = folderSection;
    this.setupFolderEvents();
  }

  private setupFolderEvents(): void {
    if (!this.containerElement) return;

    const toggleBtn = this.containerElement.querySelector('.dbx-folder-toggle-btn');
    if (toggleBtn && !toggleBtn.hasAttribute('data-dv-event-bound')) {
      toggleBtn.setAttribute('data-dv-event-bound', 'true');
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSectionCollapsed();
      });
    }

    const addBtn = this.containerElement.querySelector('.dbx-folder-add-btn');
    if (addBtn && !addBtn.hasAttribute('data-dv-event-bound')) {
      addBtn.setAttribute('data-dv-event-bound', 'true');
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showCreateFolderDialog(addBtn as HTMLElement);
      });
    }
  }

  private setupObservers(): void {
    let observerTimeout: number | null = null;
    const observer = new MutationObserver(() => {
      if (observerTimeout) clearTimeout(observerTimeout);
      observerTimeout = window.setTimeout(() => {
        const sidebar = document.querySelector('#flow_chat_sidebar');
        if (!sidebar) return;

        this.sidebarContainer = sidebar as HTMLElement;

        if (this.initialized) {
          const existingSection = document.querySelector('#dbx-folder-section');
          if (!existingSection) {
            this.findSidebarContainer();
            this.render();
          } else {
            this.containerElement = existingSection as HTMLElement;
            this.setupFolderEvents();
          }
          this.addConversationIndicators();
          this.setupFolderDropZones();
        } else {
          this.findSidebarContainer();
        }
      }, 100);
    });

    const sidebar = document.querySelector('#flow_chat_sidebar');
    if (sidebar) {
      observer.observe(sidebar, { childList: true, subtree: true });
    }
  }

  private addConversationIndicators(): void {
    const conversations = document.querySelectorAll('[data-empty-conversation="false"] a[href^="/chat/"]');
    conversations.forEach((el) => {
      const element = el as HTMLElement;
      if (element.dataset.dvProcessed) return;
      element.dataset.dvProcessed = 'true';

      const idMatch = element.id.match(/conversation_(\d+)/);
      const conversationId = idMatch ? idMatch[1] : element.getAttribute('href')?.replace('/chat/', '');

      if (!conversationId) return;

      const folders = this.findConversationFolders(conversationId);
      this.updateConversationIndicator(element, folders);

      this.setupConversationDrag(element, conversationId);
    });
    
    this.setupFolderDropZones();
  }

  private updateConversationIndicator(element: HTMLElement, folders: string[]): void {
    const existingIndicator = element.querySelector('.dbx-folder-indicator');
    
    if (folders.length > 0) {
      const firstFolder = this.data.folders.find(f => f.id === folders[0]);
      const color = firstFolder ? getFolderColor(firstFolder.color) : '#6b7280';
      
      if (existingIndicator) {
        (existingIndicator as HTMLElement).style.backgroundColor = color;
      } else {
        const indicator = createIndicator(color);
        const wrapper = element.querySelector('.wrapper-Xy3kj9') || element.querySelector('div:first-child') || element;
        if (wrapper) {
          (wrapper as HTMLElement).style.position = 'relative';
          wrapper.insertBefore(indicator, wrapper.firstChild);
        }
      }
    } else if (existingIndicator) {
      existingIndicator.remove();
    }
  }

  private refreshAllIndicators(): void {
    const conversations = document.querySelectorAll('[data-empty-conversation="false"] a[href^="/chat/"]');
    conversations.forEach((el) => {
      const element = el as HTMLElement;
      const idMatch = element.id.match(/conversation_(\d+)/);
      const conversationId = idMatch ? idMatch[1] : element.getAttribute('href')?.replace('/chat/', '');
      if (!conversationId) return;

      const folders = this.findConversationFolders(conversationId);
      this.updateConversationIndicator(element, folders);
    });
  }

  private setupConversationDrag(element: HTMLElement, conversationId: string): void {
    if (element.dataset.dvDraggable === 'true') return;
    element.dataset.dvDraggable = 'true';

    const titleEl = element.querySelector('[class*="content"]') || element.querySelector('div');
    const title = titleEl?.textContent?.trim() || '对话';

    setupDraggable(element, conversationId, title);
  }

  private setupFolderDropZones(): void {
    const folderContents = document.querySelectorAll('.dbx-folder-contents');
    folderContents.forEach((el) => {
      const element = el as HTMLElement;
      if (element.dataset.dvDropZone === 'true') return;
      element.dataset.dvDropZone = 'true';

      const folderId = element.dataset.folderId;
      if (!folderId) return;

      setupDropZone(element, {
        onDrop: (targetFolderId) => this.handleDrop(targetFolderId),
        onDragOver: () => this.expandFolderOnDrag(folderId),
      });
    });
  }

  private setupDropZoneForFolderRow(folderEl: HTMLElement, folderId: string): void {
    if (folderEl.dataset.dvDropZoneRow === 'true') return;
    folderEl.dataset.dvDropZoneRow = 'true';

    const row = folderEl.querySelector('.dbx-folder-row') as HTMLElement;
    if (!row) return;

    setupDropZone(row, {
      onDrop: (targetFolderId) => this.handleDrop(targetFolderId),
      onDragOver: () => {
        folderEl.classList.add('dbx-drop-target');
        this.expandFolderOnDrag(folderId);
      },
      onDragLeave: () => {
        folderEl.classList.remove('dbx-drop-target');
      },
    });
  }

  private expandFolderOnDrag(folderId: string): void {
    const folder = this.data.folders.find(f => f.id === folderId);
    if (folder && !folder.isExpanded) {
      folder.isExpanded = true;
      this.render();
    }
  }

  private findConversationFolders(conversationId: string): string[] {
    const folders: string[] = [];
    for (const [folderId, contents] of Object.entries(this.data.folderContents)) {
      if (contents.some(c => c.conversationId === conversationId)) {
        folders.push(folderId);
      }
    }
    return folders;
  }

  render(): void {
    if (!this.containerElement) return;
    const listEl = this.containerElement.querySelector('.dbx-folder-list');
    if (!listEl) return;

    if (this.data.folders.length === 0) {
      listEl.innerHTML = createEmptyFolderHTML();
      return;
    }

    listEl.innerHTML = this.data.folders
      .map(folder => {
        const contents = this.data.folderContents[folder.id] || [];
        return createFolderItemHTML(folder, contents);
      })
      .join('');

    this.setupFolderElementEvents();
    this.setupFolderDropZones();
    this.updateSectionCollapseUI();
  }

  private setupFolderElementEvents(): void {
    const folderItems = this.containerElement?.querySelectorAll('.dbx-folder-item');
    folderItems?.forEach((item) => {
      const folderEl = item as HTMLElement;
      const folderId = folderEl.dataset.folderId;
      if (!folderId) return;

      const row = folderEl.querySelector('.dbx-folder-row') as HTMLElement;
      if (row) {
        row.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.dbx-folder-menu-btn')) return;
          this.toggleFolder(folderId);
        });
      }

      const menuBtn = folderEl.querySelector('.dbx-folder-menu-btn');
      menuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showFolderMenu(folderId, menuBtn as HTMLElement);
      });

      this.setupDropZoneForFolderRow(folderEl, folderId);

      folderEl.querySelectorAll('.dbx-folder-conversation').forEach((conv) => {
        const convEl = conv as HTMLElement;
        
        convEl.addEventListener('click', (e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.dbx-folder-conversation-remove')) return;
          e.stopPropagation();
          const convId = convEl.dataset.conversationId;
          if (convId) {
            window.location.href = `/chat/${convId}`;
          }
        });

        const removeBtn = convEl.querySelector('.dbx-folder-conversation-remove');
        removeBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          const convId = convEl.dataset.conversationId;
          const convTitle = convEl.querySelector('.dbx-conversation-title')?.textContent || '对话';
          if (convId) {
            this.showRemoveConfirm(folderId, convId, convTitle, removeBtn as HTMLElement);
          }
        });

        this.setupFolderContentDrag(convEl, folderId);
      });
    });
  }

  private setupFolderContentDrag(convEl: HTMLElement, sourceFolderId: string): void {
    if (convEl.dataset.dvContentDragBound === 'true') return;
    convEl.dataset.dvContentDragBound = 'true';

    convEl.addEventListener('dragstart', (e) => {
      convEl.classList.add('dbx-dragging');
      const convId = convEl.dataset.conversationId;
      const convTitle = convEl.querySelector('.dbx-conversation-title')?.textContent?.trim() || '对话';

      if (e.dataTransfer && convId) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'conversation',
          conversationId: convId,
          title: convTitle,
          sourceFolderId,
        }));
      }

      this.dragData = {
        type: 'conversation',
        conversationId: convId,
        title: convTitle,
        sourceFolderId,
      };
    });

    convEl.addEventListener('dragend', () => {
      convEl.classList.remove('dbx-dragging');
      this.dragData = null;
    });
  }

  private showRemoveConfirm(folderId: string, conversationId: string, conversationTitle: string, button: HTMLElement): void {
    this.hidePopup();
    
    const rect = button.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'dbx-popup';
    popup.innerHTML = `
      <div class="dbx-popup-content">
        <div class="dbx-popup-title">从文件夹移除</div>
        <div class="dbx-popup-message">确定要将"${escapeHTML(conversationTitle)}"从文件夹中移除吗？<br>对话不会被删除，仍在历史记录中。</div>
        <div class="dbx-popup-actions">
          <button class="dbx-popup-btn dbx-popup-btn-cancel">取消</button>
          <button class="dbx-popup-btn dbx-popup-btn-danger">移除</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    this.popupElement = popup;

    if (button) {
      popup.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.bottom + 8}px;
        background: transparent;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      `;
    }

    popup.querySelector('.dbx-popup-btn-cancel')?.addEventListener('click', () => this.hidePopup());
    popup.querySelector('.dbx-popup-btn-danger')?.addEventListener('click', async () => {
      await storageService.removeConversationFromFolder(folderId, conversationId);
      this.data = await storageService.getData();
      this.render();
      this.refreshAllIndicators();
      this.hidePopup();
    });

    popup.addEventListener('click', (e) => {
      if (e.target === popup) this.hidePopup();
    });
  }

  private handleDrop(folderId: string): void {
    let conversationId = '';
    let title = '对话';
    let sourceFolderId: string | undefined;

    const droppedEl = document.querySelector('.dbx-dragging') as HTMLElement;
    if (droppedEl) {
      const idMatch = droppedEl.id.match(/conversation_(\d+)/);
      conversationId = idMatch ? idMatch[1] : droppedEl.getAttribute('href')?.replace('/chat/', '') || '';
      const titleEl = droppedEl.querySelector('[class*="content"]') || droppedEl.querySelector('div');
      title = titleEl?.textContent?.trim() || '对话';
      sourceFolderId = droppedEl.dataset.sourceFolderId || undefined;
    }

    if (this.dragData?.conversationId) {
      conversationId = this.dragData.conversationId;
      title = this.dragData.title;
      sourceFolderId = this.dragData.sourceFolderId;
    }

    if (!conversationId) return;
    if (sourceFolderId === folderId) return;

    if (sourceFolderId) {
      this.moveConversationBetweenFolders(sourceFolderId, folderId, conversationId, title);
    } else {
      this.addConversationToFolder(folderId, conversationId, title);
    }
  }

  private async addConversationToFolder(folderId: string, conversationId: string, title: string): Promise<void> {
    const conversation: ConversationReference = {
      conversationId,
      title,
      url: `/chat/${conversationId}`,
      addedAt: Date.now(),
    };

    await storageService.addConversationToFolder(folderId, conversation);
    this.data = await storageService.getData();
    this.render();
    this.refreshAllIndicators();
  }

  private async moveConversationBetweenFolders(
    sourceFolderId: string,
    targetFolderId: string,
    conversationId: string,
    title: string
  ): Promise<void> {
    const conversation: ConversationReference = {
      conversationId,
      title,
      url: `/chat/${conversationId}`,
      addedAt: Date.now(),
    };

    await storageService.moveConversationBetweenFolders(sourceFolderId, targetFolderId, conversation);
    this.data = await storageService.getData();
    this.render();
    this.refreshAllIndicators();
  }

  private toggleFolder(folderId: string): void {
    const folder = this.data.folders.find(f => f.id === folderId);
    if (folder) {
      folder.isExpanded = !folder.isExpanded;
      this.render();
    }
  }

  private toggleSectionCollapsed(): void {
    this.sectionCollapsed = !this.sectionCollapsed;
    this.updateSectionCollapseUI();
    storageService.setSectionCollapsed(this.sectionCollapsed);
  }

  private updateSectionCollapseUI(): void {
    if (!this.containerElement) return;
    this.containerElement.classList.toggle('collapsed', this.sectionCollapsed);
    const toggleBtn = this.containerElement.querySelector('.dbx-folder-toggle-btn');
    toggleBtn?.classList.toggle('collapsed', this.sectionCollapsed);
  }

  private showCreateFolderDialog(button?: HTMLElement): void {
    this.hidePopup();
    
    const popup = document.createElement('div');
    popup.className = 'dbx-popup';
    popup.innerHTML = `
      <div class="dbx-popup-content">
        <div class="dbx-popup-title">新建文件夹</div>
        <input type="text" class="dbx-popup-input" placeholder="输入文件夹名称" maxlength="20">
        <div class="dbx-popup-color-label">选择颜色</div>
        <div class="dbx-popup-colors">
          ${this.getColorOptionsHTML('blue')}
        </div>
        <div class="dbx-popup-actions">
          <button class="dbx-popup-btn dbx-popup-btn-cancel">取消</button>
          <button class="dbx-popup-btn dbx-popup-btn-confirm">创建</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    this.popupElement = popup;

    if (button) {
      const rect = button.getBoundingClientRect();
      const popupHeight = 280;
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      
      let top: number;
      if (spaceBelow >= popupHeight + 8) {
        top = rect.bottom + 8;
      } else {
        top = rect.top - popupHeight - 8;
      }
      
      popup.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${top}px;
        background: transparent;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      `;
    }

    const input = popup.querySelector('.dbx-popup-input') as HTMLInputElement;
    input?.focus();

    let selectedColor = 'blue';
    const colorOptions = popup.querySelectorAll('.dbx-color-option');
    colorOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        colorOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedColor = (opt as HTMLElement).dataset.color || 'blue';
      });
    });
    colorOptions[0]?.classList.add('selected');
    selectedColor = (colorOptions[0] as HTMLElement)?.dataset.color || 'blue';

    const colorPicker = popup.querySelector('.dbx-color-picker') as HTMLInputElement;
    const customColorOption = popup.querySelector('.dbx-color-custom');
    
    customColorOption?.addEventListener('click', (e) => {
      e.stopPropagation();
      colorPicker?.click();
    });
    
    colorPicker?.addEventListener('input', () => {
      colorOptions.forEach(o => o.classList.remove('selected'));
      customColorOption?.classList.add('selected');
      customColorOption?.classList.add('has-custom-color');
      (customColorOption as HTMLElement).style.setProperty('--custom-color', colorPicker.value);
      (customColorOption as HTMLElement).setAttribute('data-color', colorPicker.value);
      selectedColor = colorPicker.value;
    });
    
    colorPicker?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    popup.querySelector('.dbx-popup-btn-cancel')?.addEventListener('click', () => this.hidePopup());
    popup.querySelector('.dbx-popup-btn-confirm')?.addEventListener('click', async () => {
      const name = input.value.trim();
      if (!name) return;

      const folder: Folder = {
        id: `folder_${Date.now()}`,
        name,
        parentId: null,
        color: selectedColor,
        isExpanded: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storageService.addFolder(folder);
      this.data = await storageService.getData();
      this.render();
      this.hidePopup();
    });

    popup.addEventListener('click', (e) => {
      if (e.target === popup) this.hidePopup();
    });
  }

  private getColorOptionsHTML(selected?: string): string {
    const colors = [
      { id: 'blue', value: '#3b82f6' },
      { id: 'green', value: '#22c55e' },
      { id: 'yellow', value: '#eab308' },
      { id: 'orange', value: '#f97316' },
      { id: 'red', value: '#ef4444' },
      { id: 'purple', value: '#a855f7' },
      { id: 'pink', value: '#ec4899' },
      { id: 'gray', value: '#6b7280' },
    ];
    
    const isCustom = selected && !colors.find(c => c.id === selected);
    const customValue = isCustom ? selected : '#3b82f6';
    const customColorHtml = `
      <div class="dbx-color-option dbx-color-custom ${isCustom ? 'selected' : ''}" data-color="${customValue}" style="background-color: ${isCustom ? selected : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)'}">
        <input type="color" class="dbx-color-picker" value="${customValue}">
      </div>
    `;
    
    return colors.map(c => 
      `<div class="dbx-color-option ${selected === c.id ? 'selected' : ''}" data-color="${c.id}" style="background-color: ${c.value}"></div>`
    ).join('') + customColorHtml;
  }

  private showFolderMenu(folderId: string, button: HTMLElement): void {
    this.hidePopup();
    
    const folder = this.data.folders.find(f => f.id === folderId);
    if (!folder) return;
    
    const rect = button.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'dbx-folder-context-menu';
    popup.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 4}px;
      left: ${rect.left - 60}px;
      z-index: 10000;
    `;
    popup.innerHTML = `
      <div class="dbx-folder-menu-item" data-action="rename">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span>重命名</span>
      </div>
      <div class="dbx-folder-menu-item" data-action="color">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="13.5" cy="6.5" r="2.5"></circle>
          <circle cx="17.5" cy="10.5" r="2.5"></circle>
          <circle cx="8.5" cy="7.5" r="2.5"></circle>
          <circle cx="6.5" cy="12.5" r="2.5"></circle>
        </svg>
        <span>更换颜色</span>
      </div>
      <div class="dbx-folder-menu-item danger" data-action="delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        <span>删除</span>
      </div>
    `;

    document.body.appendChild(popup);
    this.popupElement = popup;

    popup.querySelectorAll('.dbx-folder-menu-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = (item as HTMLElement).dataset.action;
        
        this.hidePopup();
        
        setTimeout(() => {
          if (action === 'rename') {
            this.showRenameDialog(folder, button);
          } else if (action === 'color') {
            this.showColorPicker(folder, button);
          } else if (action === 'delete') {
            this.showDeleteConfirm(folder, folderId, button);
          }
        }, 50);
      });
    });

    const handleOutsideClick = (e: MouseEvent) => {
      if (this.popupElement && !this.popupElement.contains(e.target as Node)) {
        this.hidePopup();
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick, { once: true });
    }, 0);
  }

  private showRenameDialog(folder: Folder, button?: HTMLElement): void {
    this.hidePopup();
    
    const popup = document.createElement('div');
    popup.className = 'dbx-popup';
    popup.innerHTML = `
      <div class="dbx-popup-content">
        <div class="dbx-popup-title">重命名文件夹</div>
        <input type="text" class="dbx-popup-input" placeholder="输入新名称" maxlength="20" value="${folder.name}">
        <div class="dbx-popup-actions">
          <button class="dbx-popup-btn dbx-popup-btn-cancel">取消</button>
          <button class="dbx-popup-btn dbx-popup-btn-confirm">确定</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    this.popupElement = popup;

    if (button) {
      const rect = button.getBoundingClientRect();
      popup.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.bottom + 8}px;
        background: transparent;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      `;
    }

    const input = popup.querySelector('.dbx-popup-input') as HTMLInputElement;
    input?.focus();
    input?.select();

    popup.querySelector('.dbx-popup-btn-cancel')?.addEventListener('click', () => this.hidePopup());
    popup.querySelector('.dbx-popup-btn-confirm')?.addEventListener('click', async () => {
      const name = input.value.trim();
      if (!name) return;

      await storageService.updateFolder(folder.id, { name });
      this.data = await storageService.getData();
      this.render();
      this.hidePopup();
    });

    popup.addEventListener('click', (e) => {
      if (e.target === popup) this.hidePopup();
    });
  }

  private showColorPicker(folder: Folder, button?: HTMLElement): void {
    this.hidePopup();
    
    const popup = document.createElement('div');
    popup.className = 'dbx-popup';
    popup.innerHTML = `
      <div class="dbx-popup-content">
        <div class="dbx-popup-title">选择颜色</div>
        <div class="dbx-popup-colors dbx-popup-colors-lg">
          ${this.getColorOptionsHTML(folder.color)}
        </div>
        <div class="dbx-popup-actions">
          <button class="dbx-popup-btn dbx-popup-btn-cancel">取消</button>
          <button class="dbx-popup-btn dbx-popup-btn-confirm">确定</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    this.popupElement = popup;

    if (button) {
      const rect = button.getBoundingClientRect();
      popup.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.bottom + 8}px;
        background: transparent;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      `;
    }

    let selectedColor = folder.color;
    const colorOptions = popup.querySelectorAll('.dbx-color-option');
    const colorPicker = popup.querySelector('.dbx-color-picker') as HTMLInputElement;
    const customColorOption = popup.querySelector('.dbx-color-custom');
    
    colorOptions.forEach(opt => {
      opt.addEventListener('click', async () => {
        if ((opt as HTMLElement).classList.contains('dbx-color-custom')) {
          return;
        }
        colorOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedColor = (opt as HTMLElement).dataset.color || folder.color;
        
        await storageService.updateFolder(folder.id, { color: selectedColor });
        this.data = await storageService.getData();
        this.render();
        this.refreshAllIndicators();
        this.hidePopup();
      });
    });
    
    customColorOption?.addEventListener('click', (e) => {
      e.stopPropagation();
      colorPicker?.click();
    });
    
    colorPicker?.addEventListener('input', () => {
      colorOptions.forEach(o => o.classList.remove('selected'));
      customColorOption?.classList.add('selected');
      customColorOption?.classList.add('has-custom-color');
      (customColorOption as HTMLElement).style.setProperty('--custom-color', colorPicker.value);
      (customColorOption as HTMLElement).setAttribute('data-color', colorPicker.value);
      selectedColor = colorPicker.value;
    });
    
    colorPicker?.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    let confirmBtn = popup.querySelector('.dbx-popup-btn-confirm') as HTMLButtonElement;
    confirmBtn?.addEventListener('click', async () => {
      await storageService.updateFolder(folder.id, { color: selectedColor });
      this.data = await storageService.getData();
      this.render();
      this.refreshAllIndicators();
      this.hidePopup();
    });
    
    popup.querySelector('.dbx-popup-btn-cancel')?.addEventListener('click', () => this.hidePopup());

    popup.addEventListener('click', (e) => {
      if (e.target === popup) this.hidePopup();
    });
  }

  private showDeleteConfirm(folder: Folder, folderId: string, button?: HTMLElement): void {
    this.hidePopup();
    
    const popup = document.createElement('div');
    popup.className = 'dbx-popup';
    popup.innerHTML = `
      <div class="dbx-popup-content">
        <div class="dbx-popup-title">删除文件夹</div>
        <div class="dbx-popup-message">确定要删除"${folder.name}"吗？</div>
        <div class="dbx-popup-actions">
          <button class="dbx-popup-btn dbx-popup-btn-cancel">取消</button>
          <button class="dbx-popup-btn dbx-popup-btn-danger">删除</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    this.popupElement = popup;

    if (button) {
      const rect = button.getBoundingClientRect();
      popup.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.bottom + 8}px;
        background: transparent;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      `;
    } else {
      popup.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
    }

    popup.querySelector('.dbx-popup-btn-cancel')?.addEventListener('click', () => this.hidePopup());
    popup.querySelector('.dbx-popup-btn-danger')?.addEventListener('click', async () => {
      await storageService.deleteFolder(folderId);
      this.data = await storageService.getData();
      this.render();
      this.refreshAllIndicators();
      this.hidePopup();
    });

    popup.addEventListener('click', (e) => {
      if (e.target === popup) this.hidePopup();
    });
  }

  private hidePopup(): void {
    if (this.popupElement) {
      this.popupElement.remove();
      this.popupElement = null;
    }
  }

  destroy(): void {
    this.containerElement = null;
    this.sidebarContainer = null;
    this.hidePopup();
  }
}

export const folderManager = new FolderManager();
