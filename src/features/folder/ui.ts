import { Folder, ConversationReference, getFolderColor } from '../../core';

export interface DropZoneConfig {
  onDrop: (folderId: string) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: (e: DragEvent) => void;
}

export function createFolderItemHTML(folder: Folder, contents: ConversationReference[]): string {
  const color = getFolderColor(folder.color);
  const isExpanded = folder.isExpanded;
  
  return `
    <div class="dbx-folder-item ${isExpanded ? 'expanded' : ''}" data-folder-id="${folder.id}" data-folder-color="${folder.color}">
      <div class="dbx-folder-row" data-folder-id="${folder.id}">
        <div class="dbx-folder-expand-icon ${isExpanded ? 'expanded' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"></path>
          </svg>
        </div>
        <div class="dbx-folder-color-dot" style="background-color: ${color}"></div>
        <span class="dbx-folder-name">${escapeHTML(folder.name)}</span>
        <span class="dbx-folder-count">${contents.length}</span>
        <button class="dbx-folder-menu-btn" title="更多操作">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"></circle>
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="12" cy="19" r="1.5"></circle>
          </svg>
        </button>
      </div>
      <div class="dbx-folder-contents" data-folder-id="${folder.id}">
        ${contents.map(c => createConversationItemHTML(c)).join('')}
      </div>
    </div>
  `;
}

export function createConversationItemHTML(conversation: ConversationReference): string {
  return `
    <div class="dbx-folder-conversation" draggable="true" data-conversation-id="${conversation.conversationId}">
      <div class="dbx-conversation-icon">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <span class="dbx-conversation-title">${escapeHTML(conversation.title)}</span>
      <button class="dbx-folder-conversation-remove" title="从文件夹移除">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  `;
}

export function createEmptyFolderHTML(): string {
  return '<div class="dbx-folder-empty">暂无文件夹</div>';
}

export function createFolderSectionHTML(): string {
  return `
    <div id="dbx-folder-section" class="dbx-folder-section">
      <div class="dbx-folder-header">
        <div class="dbx-folder-title-row">
          <svg class="dbx-folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="dbx-folder-title">文件夹</span>
        </div>
        <div class="dbx-folder-header-actions">
          <button class="dbx-folder-toggle-btn" title="收起/展开">
            <svg class="dbx-folder-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6"></path>
            </svg>
          </button>
          <button class="dbx-folder-add-btn" title="新建文件夹">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="dbx-folder-list"></div>
    </div>
  `;
}

export function setupDropZone(element: HTMLElement, config: DropZoneConfig): void {
  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.classList.add('dbx-drop-target');
    config.onDragOver?.(e);
  });

  element.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.classList.remove('dbx-drop-target');
    config.onDragLeave?.(e);
  });

  element.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    element.classList.remove('dbx-drop-target');
    const folderId = element.dataset.folderId;
    if (folderId) {
      config.onDrop(folderId);
    }
  });
}

export function setupDraggable(element: HTMLElement, conversationId: string, title: string): void {
  element.draggable = true;
  
  element.addEventListener('dragstart', (e) => {
    element.classList.add('dbx-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/json', JSON.stringify({
        type: 'conversation',
        conversationId,
        title,
      }));
    }
  });

  element.addEventListener('dragend', () => {
    element.classList.remove('dbx-dragging');
  });
}

export function createIndicator(color: string): HTMLElement {
  const indicator = document.createElement('div');
  indicator.className = 'dbx-folder-indicator';
  indicator.style.backgroundColor = color;
  indicator.style.left = '2px';
  return indicator;
}

export function escapeHTML(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export { getFolderColor };
