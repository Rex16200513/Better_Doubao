import { storageService } from '../../core/services/StorageService';
import { pageLifecycle } from '../../core/services/PageLifecycle';
import { escapeHTML, getConversationId } from '../../core/utils/dom';
import { showConfirmDialog, showToast } from '../../core/utils/ui';
import type { CorpusItem } from '../../core/types/folder';
import { textHighlighter } from './TextHighlighter';

export class CorpusBoard {
  private triggerBtn: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private initialized = false;
  private isExpanded = false;
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private positionX = 0;
  private positionY = 0;
  private corpusItems: CorpusItem[] = [];
  private unsubscribeDom: (() => void) | null = null;
  private unsubscribeUrl: (() => void) | null = null;
  private highlightRestoreTimer: number | null = null;
  private highlightPaletteResizeHandler: (() => void) | null = null;
  private positionResizeHandler: (() => void) | null = null;

  init(): void {
    if (this.initialized) return;

    this.loadCorpusItems();
    this.createTriggerButton();
    this.setupTextSelectionListener();
    this.setupHighlightPersistence();
    this.setupPositionTracking();
    this.initialized = true;
    
    setTimeout(() => {
      this.recalculatePosition();
    }, 2000);
  }
  
  private recalculatePosition(): void {
    // 页面初次加载时输入框可能尚未渲染，2 秒后用真实输入框位置校正。
    // 但若用户已拖动自定义过位置（localStorage 有记录），则尊重用户偏好不覆盖。
    if (localStorage.getItem('dbx_corpus_trigger_pos')) {
      return;
    }
    const newPos = this.getDefaultPosition();
    this.positionX = newPos.x;
    this.positionY = newPos.y;
    this.applyTriggerPosition();
  }

  private async loadCorpusItems(): Promise<void> {
    try {
      const allItems = await storageService.getCorpusBoard();
      const currentConversationId = this.getConversationId();
      this.corpusItems = allItems.filter(item => item.conversationId === currentConversationId);
    } catch (error) {
      console.error('[CorpusBoard] Failed to load corpus items:', error);
      this.corpusItems = [];
    }
  }
 
  private createTriggerButton(): void {
    if (this.triggerBtn) return;

    const savedPos = this.loadPosition();
    this.positionX = savedPos.x;
    this.positionY = savedPos.y;

    this.triggerBtn = document.createElement('div');
    this.triggerBtn.id = 'dbx-corpus-trigger';
    this.triggerBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
      <span class="dbx-corpus-count${this.corpusItems.length === 0 ? ' is-empty' : ''}">${this.corpusItems.length}</span>
    `;

    this.triggerBtn.style.cssText = this.getTriggerStyles();
    // cssText 会覆盖先前设置的 left/top；必须最后应用坐标。
    this.applyTriggerPosition();
    this.triggerBtn.style.display = 'flex';

    this.triggerBtn.addEventListener('click', () => {
      if (!this.isDragging) {
        document.dispatchEvent(new CustomEvent('dbx-toggle-tools'));
      }
    });

    this.setupDrag();

    document.body.appendChild(this.triggerBtn);
  }

  private getTriggerStyles(): string {
    return `
      position: fixed;
      z-index: 9998;
      width: 40px;
      height: 40px;
      background: var(--dbx-surface-glass, #fff);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--dbx-border, rgba(15, 23, 42, 0.09));
      border-radius: 12px;
      box-shadow: var(--dbx-shadow, 0 4px 16px rgba(15, 23, 42, 0.08));
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      color: var(--dbx-text-secondary, #4b5563);
      transition: box-shadow 0.2s, transform 0.1s;
      user-select: none;
    `;
  }

  private applyTriggerPosition(): void {
    if (!this.triggerBtn) return;
    this.triggerBtn.style.right = 'auto';
    this.triggerBtn.style.bottom = 'auto';
    this.triggerBtn.style.left = `${this.positionX}px`;
    this.triggerBtn.style.top = `${this.positionY}px`;
  }

  private getDefaultPosition(): { x: number; y: number } {
    // 触发按钮 44x44，留 12px 边距，并把坐标钳制在视口内，避免跑到屏幕外不可见
    const btn = 44, margin = 12;
    const clamp = (x: number, y: number): { x: number; y: number } => ({
      x: Math.max(margin, Math.min(x, window.innerWidth - btn - margin)),
      y: Math.max(margin, Math.min(y, window.innerHeight - btn - margin))
    });

    const inputArea = this.findInputArea();
    if (inputArea) {
      const rect = inputArea.getBoundingClientRect();
      const rightSideX = rect.right + margin;
      const x = rightSideX + btn + margin <= window.innerWidth
        ? rightSideX
        : rect.left - btn - margin;
      return clamp(x, rect.top + Math.max(0, (rect.height - btn) / 2));
    }

    const locatorBar = document.querySelector('#dbx-quick-locator');
    if (locatorBar) {
      const rect = locatorBar.getBoundingClientRect();
      return clamp(rect.left - btn - margin, rect.top);
    }

    return clamp(window.innerWidth - btn - margin, window.innerHeight - 200);
  }

  private setupPositionTracking(): void {
    this.positionResizeHandler = this.debouncePositionUpdate(() => {
      const saved = localStorage.getItem('dbx_corpus_trigger_pos');
      if (!saved) {
        this.recalculatePosition();
        return;
      }

      this.positionX = Math.max(12, Math.min(this.positionX, window.innerWidth - 56));
      this.positionY = Math.max(12, Math.min(this.positionY, window.innerHeight - 56));
      this.applyTriggerPosition();
    }, 150);
    window.addEventListener('resize', this.positionResizeHandler);
  }

  private debouncePositionUpdate(fn: () => void, delay: number): () => void {
    let timer: number | null = null;
    return () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(fn, delay);
    };
  }

  private loadPosition(): { x: number; y: number } {
    const defaultPos = this.getDefaultPosition();

    try {
      const saved = localStorage.getItem('dbx_corpus_trigger_pos');
      if (saved) {
        const pos = JSON.parse(saved);
        // 旧版本只保存 x/y，页面改版后这些坐标已失去锚点意义，自动重置一次。
        if (!pos.viewportWidth || !pos.viewportHeight) {
          localStorage.removeItem('dbx_corpus_trigger_pos');
          return defaultPos;
        }
        // 用户自定义过的位置，需保证按钮（44x44）完整落在视口内才保留
        if (pos.x >= 0 && pos.x + 44 <= window.innerWidth && pos.y >= 0 && pos.y + 44 <= window.innerHeight) {
          return pos;
        } else {
          localStorage.removeItem('dbx_corpus_trigger_pos');
        }
      }
    } catch {
      // Ignore malformed stored position
    }
    return defaultPos;
  }

  private savePosition(): void {
    try {
      localStorage.setItem('dbx_corpus_trigger_pos', JSON.stringify({
        x: this.positionX,
        y: this.positionY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      }));
    } catch (e) {}
  }

  private setupDrag(): void {
    if (!this.triggerBtn) return;

    const onMouseDown = (e: MouseEvent) => {
      if (this.isExpanded) {
        e.preventDefault();
        return;
      }
      
      const target = e.target as HTMLElement;
      if (target.closest('.dbx-corpus-panel')) return;
      
      this.isDragging = false;
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = this.triggerBtn!.getBoundingClientRect();
      this.dragOffsetX = startX - rect.left;
      this.dragOffsetY = startY - rect.top;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dx = Math.abs(moveEvent.clientX - startX);
        const dy = Math.abs(moveEvent.clientY - startY);
        if (dx > 5 || dy > 5) {
          this.isDragging = true;
        }

        if (this.isDragging) {
          this.positionX = moveEvent.clientX - this.dragOffsetX;
          this.positionY = moveEvent.clientY - this.dragOffsetY;
          this.applyTriggerPosition();
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        if (this.isDragging) {
          this.savePosition();
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    this.triggerBtn.addEventListener('mousedown', onMouseDown);
  }

  openPanel(): void {
    if (this.panel && !this.panel.isConnected) this.panel = null;
    this.isExpanded = true;
    this.createPanel();
    this.updatePanelContent();
  }

  closePanel(): void {
    this.isExpanded = false;
    this.hidePanel();
  }

  private createPanel(): void {
    if (this.panel) return;

    this.panel = document.createElement('div');
    this.panel.className = 'dbx-corpus-panel dbx-unified-panel';
    this.panel.style.cssText = this.getPanelStyles();
    document.body.appendChild(this.panel);

    document.addEventListener('click', this.handleOutsideClick);
  }

  private getPanelStyles(): string {
    const triggerRect = this.triggerBtn?.getBoundingClientRect();
    const panelWidth = Math.min(316, window.innerWidth - 24);
    const panelHeight = Math.min(480, window.innerHeight - 24);
    
    let left = triggerRect ? triggerRect.left - panelWidth - 12 : this.positionX - panelWidth - 12;
    let top = triggerRect ? triggerRect.top : this.positionY;
    
    if (left < 12) {
      left = triggerRect ? triggerRect.right + 12 : this.positionX + 60;
    }
    if (left + panelWidth > window.innerWidth - 12) {
      left = window.innerWidth - panelWidth - 12;
    }
    if (top < 12) {
      top = triggerRect ? triggerRect.bottom + 12 : this.positionY + 60;
    }
    if (top + panelHeight > window.innerHeight - 12) {
      top = window.innerHeight - panelHeight - 12;
    }

    return `left: ${left}px; top: ${top}px; width: ${panelWidth}px; max-height: ${panelHeight}px;`;
  }

  private handleOutsideClick = (e: MouseEvent): void => {
    if (this.panel && !this.panel.contains(e.target as Node) && 
        this.triggerBtn && !this.triggerBtn.contains(e.target as Node)) {
      this.isExpanded = false;
      this.hidePanel();
    }
  };

  private updatePanelContent(): void {
    if (!this.panel) return;

    const count = this.corpusItems.length;
    const selectedCount = this.corpusItems.filter(item => item.selected).length;
    
    this.panel.innerHTML = `
      <div class="dbx-corpus-header">
        <div class="dbx-corpus-header-left">
          <span class="dbx-corpus-title">语料板</span>
          <span class="dbx-corpus-header-count">${count} 条</span>
        </div>
        <div class="dbx-corpus-header-right">
          <button type="button" class="dbx-corpus-clear-btn" title="清空当前对话语料" ${count === 0 ? 'disabled' : ''}>清空</button>
        </div>
      </div>
      <div class="dbx-corpus-list">
        ${this.corpusItems.length === 0 ? `
          <div class="dbx-corpus-empty">
            <div class="dbx-corpus-empty-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div>暂无语料</div>
            <small>选中对话文字，点击浮动按钮即可收藏</small>
          </div>
        ` : ''}
        ${this.corpusItems.length > 0 ? `
          <div class="dbx-corpus-select-all">
            <input type="checkbox" id="dbx-corpus-select-all" ${selectedCount === count && count > 0 ? 'checked' : ''}>
            <label for="dbx-corpus-select-all">全选</label>
          </div>
        ` : ''}
        ${this.corpusItems.map(item => `
          <div class="dbx-corpus-item ${item.selected ? 'selected' : ''}" data-id="${escapeHTML(item.id)}">
            <div class="dbx-corpus-item-checkbox">
              <input type="checkbox" ${item.selected ? 'checked' : ''}>
            </div>
            <div class="dbx-corpus-item-body">
              <div class="dbx-corpus-item-content">${escapeHTML(item.text)}</div>
            </div>
            <button type="button" class="dbx-corpus-item-remove" title="删除">×</button>
          </div>
        `).join('')}
      </div>
      <div class="dbx-corpus-footer">
        <button type="button" class="dbx-corpus-add-btn" ${selectedCount === 0 ? 'disabled' : ''}>添加到对话框${selectedCount > 0 ? ` (${selectedCount})` : ''}</button>
      </div>
    `;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'dbx-panel-close';
    closeButton.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeButton.title = '关闭'; closeButton.setAttribute('aria-label', '关闭语料板');
    closeButton.addEventListener('click', event => { event.stopPropagation(); this.closePanel(); });
    this.panel.querySelector('.dbx-corpus-header-right')?.appendChild(closeButton);
    this.updateTriggerCount();

    this.panel.querySelector('.dbx-corpus-clear-btn')?.addEventListener('click', () => {
      this.clearCorpus();
    });

    const selectAllCheckbox = this.panel.querySelector('#dbx-corpus-select-all') as HTMLInputElement;
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', () => {
        const checked = selectAllCheckbox.checked;
        this.corpusItems.forEach(item => {
          item.selected = checked;
        });
        this.updatePanelContent();
      });
    }

    this.panel.querySelectorAll('.dbx-corpus-item').forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
      checkbox?.addEventListener('change', () => {
        const id = item.getAttribute('data-id');
        const corpusItem = this.corpusItems.find(i => i.id === id);
        if (corpusItem) {
          corpusItem.selected = checkbox.checked;
          item.classList.toggle('selected', checkbox.checked);
          this.updatePanelContent();
        }
      });
    });

    this.panel.querySelectorAll('.dbx-corpus-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.target as HTMLElement).closest('.dbx-corpus-item')?.getAttribute('data-id');
        if (id) this.removeCorpusItem(id);
      });
    });

    this.panel.querySelector('.dbx-corpus-add-btn')?.addEventListener('click', () => {
      this.addToInput();
    });
  }

  private isInChatMessageArea(el: Element | null): boolean {
    if (!el) return false;
    const testid = el.getAttribute('data-testid') || '';
    let className = '';
    try {
      className = (el as HTMLElement).className?.toString() || '';
    } catch {
      className = '';
    }

    if (
      testid.includes('message') ||
      testid.includes('message-list') ||
      testid.includes('message_content') ||
      testid.includes('message_text') ||
      className.includes('message-list') ||
      className.includes('message-block')
    ) {
      return true;
    }

    if (
      el.classList.contains('flow-markdown-body') ||
      el.closest('[data-testid="message-list"]')
    ) {
      return true;
    }

    return this.isInChatMessageArea(el.parentElement);
  }

  private updateTriggerCount(): void {
    const countEl = this.triggerBtn?.querySelector('.dbx-corpus-count');
    if (countEl) {
      countEl.textContent = String(this.corpusItems.length);
      countEl.classList.toggle('is-empty', this.corpusItems.length === 0);
    }
  }

  private hidePanel(): void {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    document.removeEventListener('click', this.handleOutsideClick);
  }

  private setupTextSelectionListener(): void {
    let selectionButton: HTMLElement | null = null;
    let hideTimeout: number | null = null;
    let savedSelectionText: string = '';
    let savedSelectionRange: Range | null = null;
    let selectedHighlightColor = '#FDEB00';

    const showSelectionButton = (selection: Selection, text: string) => {
      if (!text || text.trim().length === 0) {
        if (selectionButton) {
          selectionButton.style.display = 'none';
        }
        return;
      }

      savedSelectionText = text;
      
      const range = selection.getRangeAt(0);
      savedSelectionRange = range.cloneRange();
      const rect = range.getBoundingClientRect();
      
      const container = range.commonAncestorContainer;
      const containerEl = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element;

      if (!containerEl || containerEl.closest('.dbx-popup-content')) {
        return;
      }
      
      if (!this.isInChatMessageArea(containerEl)) {
        return;
      }
      
      if (!selectionButton) {
        selectionButton = document.createElement('div');
        selectionButton.className = 'dbx-corpus-selection-btn';
        selectionButton.innerHTML = `
  <span class="dbx-corpus-add-action">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
    <span>添加到语料板</span>
  </span>

  <span class="dbx-highlight-divider"></span>

  <button type="button" class="dbx-highlight-action" title="高亮标记">
    <svg class="dbx-highlight-icon" width="12" height="14"
  viewBox="0 0 122 147" aria-hidden="true">
  <rect
    x="22.3711"
    y="60.2461"
    width="85.2099"
    height="55.2471"
    transform="rotate(-44.9923 22.3711 60.2461)"
    class="dbx-highlight-icon-body"
  />
  <path
    d="M56.7333 103.832L17.6786 64.5547V90.6656L1.00195 110.413H27.1126L32.8175 103.832H56.7333Z"
    class="dbx-highlight-icon-tip"
  />
  <rect
    y="124.074"
    width="119.172"
    height="22.9062"
    class="dbx-highlight-icon-color"
  />
</svg>
  </button>

  <button type="button" class="dbx-highlight-menu-toggle" title="选择高亮颜色">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>

  <div class="dbx-highlight-palette" hidden>
  <button type="button" class="dbx-highlight-swatch dbx-highlight-remove" title="取消高亮">
    <svg viewBox="0 0 219 219" aria-hidden="true">
      <circle cx="109.481" cy="109.481" r="104.981" stroke="black" stroke-width="9" fill="none"/>
      <rect x="5.96094" y="185.586" width="254.852" height="23.1796" rx="11.5898"
        transform="rotate(-41.4035 5.96094 185.586)" fill="#F2696A"/>
    </svg>
  </button>
  <button type="button" class="dbx-highlight-swatch" data-color="#FDEB00" style="--dbx-swatch-color: #FDEB00" title="黄色"></button>
  <button type="button" class="dbx-highlight-swatch" data-color="#00E52B" style="--dbx-swatch-color: #00E52B" title="绿色"></button>
  <button type="button" class="dbx-highlight-swatch" data-color="#09DCE5" style="--dbx-swatch-color: #09DCE5" title="青色"></button>
  <button type="button" class="dbx-highlight-swatch" data-color="#F000C8" style="--dbx-swatch-color: #F000C8" title="粉色"></button>
  <button type="button" class="dbx-highlight-swatch" data-color="#FF1616" style="--dbx-swatch-color: #FF1616" title="红色"></button>
  <button type="button" class="dbx-highlight-swatch" data-color="#747A89" style="--dbx-swatch-color: #747A89" title="灰色"></button>
</div>
`;
        selectionButton.style.cssText = `
          position: fixed;
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: #4f46e5;
          color: #fff;
          font-size: 12px;
          font-weight: 500;
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
          cursor: pointer;
          white-space: nowrap;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        const corpusAction = selectionButton.querySelector('.dbx-corpus-add-action');
corpusAction?.addEventListener('click', (e) => {
  e.stopPropagation();

  if (savedSelectionText) {
    this.addToCorpus(savedSelectionText);
    this.flashTriggerButton();
  }

  selectionButton!.style.display = 'none';
  savedSelectionText = '';
  savedSelectionRange = null;
});

const highlightAction = selectionButton.querySelector(
  '.dbx-highlight-action'
) as HTMLElement | null;

const applyHighlight = async (color: string) => {
  if (!savedSelectionRange || savedSelectionRange.collapsed) return;

  try {
    const applied = await textHighlighter.applyHighlight(savedSelectionRange, color);
    if (!applied) return;

    window.getSelection()?.removeAllRanges();
    selectionButton!.style.display = 'none';
    savedSelectionText = '';
    savedSelectionRange = null;
  } catch (error) {
    console.error('[CorpusBoard] Failed to highlight text:', error);
  }
};

highlightAction?.addEventListener('click', (e) => {
  e.stopPropagation();
  void applyHighlight(selectedHighlightColor);
});
const menuToggle = selectionButton.querySelector(
  '.dbx-highlight-menu-toggle'
) as HTMLButtonElement | null;

const palette = selectionButton.querySelector(
  '.dbx-highlight-palette'
) as HTMLElement | null;

const positionHighlightPalette = () => {
  if (!palette || palette.hidden || !selectionButton) return;

  const viewportMargin = 8;
  const horizontalOverlap = 64;
  const verticalOverlap = 5;
  const buttonRect = selectionButton.getBoundingClientRect();
  const paletteRect = palette.getBoundingClientRect();

  let left = buttonRect.right - horizontalOverlap;
  let top = buttonRect.bottom - verticalOverlap;

  if (left + paletteRect.width > window.innerWidth - viewportMargin) {
    left = buttonRect.left - paletteRect.width + horizontalOverlap;
  }

  if (top + paletteRect.height > window.innerHeight - viewportMargin) {
    top = buttonRect.top - paletteRect.height + verticalOverlap;
  }

  const maxLeft = Math.max(
    viewportMargin,
    window.innerWidth - paletteRect.width - viewportMargin
  );
  const maxTop = Math.max(
    viewportMargin,
    window.innerHeight - paletteRect.height - viewportMargin
  );

  palette.style.left = `${Math.min(Math.max(viewportMargin, left), maxLeft)}px`;
  palette.style.top = `${Math.min(Math.max(viewportMargin, top), maxTop)}px`;
};

this.highlightPaletteResizeHandler = positionHighlightPalette;
window.addEventListener('resize', positionHighlightPalette);

menuToggle?.addEventListener('click', (e) => {
  e.stopPropagation();

  if (!palette) return;

  palette.hidden = !palette.hidden;
  menuToggle.classList.toggle('is-open', !palette.hidden);

  if (!palette.hidden) {
    window.requestAnimationFrame(positionHighlightPalette);
  }
});
palette
  ?.querySelectorAll<HTMLButtonElement>(
    '.dbx-highlight-swatch[data-color]'
  )
  .forEach((swatch) => {
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();

      const color = swatch.dataset.color;
      if (!color) return;

      selectedHighlightColor = color;

      highlightAction?.style.setProperty(
        '--dbx-highlight-color',
        selectedHighlightColor
      );

      void applyHighlight(selectedHighlightColor);
    });
  });

  const removeHighlightButton = selectionButton.querySelector(
  '.dbx-highlight-remove'
) as HTMLButtonElement | null;

removeHighlightButton?.addEventListener('click', async (e) => {
  e.stopPropagation();

  if (!savedSelectionRange) return;
  await textHighlighter.removeSelectedHighlightPortions(savedSelectionRange.cloneRange());

  window.getSelection()?.removeAllRanges();
  selectionButton!.style.display = 'none';
  savedSelectionText = '';
  savedSelectionRange = null;
});

        document.body.appendChild(selectionButton);
      }

      const palette = selectionButton.querySelector(
        '.dbx-highlight-palette'
      ) as HTMLElement | null;
      const menuToggle = selectionButton.querySelector(
        '.dbx-highlight-menu-toggle'
      );

      if (palette) {
        palette.hidden = true;
      }
      menuToggle?.classList.remove('is-open');

      // Show invisibly first so getBoundingClientRect() returns real dimensions even on first open.
      selectionButton.style.visibility = 'hidden';
      selectionButton.style.display = 'flex';
      const buttonRect = selectionButton.getBoundingClientRect();
      const rawLeft = rect.left + rect.width / 2 - buttonRect.width / 2;
      const maxLeft = Math.max(8, window.innerWidth - buttonRect.width - 8);
      const maxTop = Math.max(8, window.innerHeight - buttonRect.height - 8);
      const left = Math.min(Math.max(8, rawLeft), maxLeft);
      const top = Math.min(Math.max(8, rect.bottom + 8), maxTop);

      selectionButton.style.left = `${left}px`;
      selectionButton.style.top = `${top}px`;
      selectionButton.style.visibility = 'visible';
    };

    document.addEventListener('mouseup', (e: MouseEvent) => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      
      const target = e.target as HTMLElement;
      if (target.closest('.dbx-corpus-panel') || target.closest('.dbx-corpus-trigger') || target.closest('.dbx-corpus-selection-btn')) {
        return;
      }

      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() || '';
      
      if (selectedText.length > 0) {
        const range = selection!.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const containerEl = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element;
        
        if (containerEl) {
          if (containerEl.closest('.dbx-popup-content') || !this.isInChatMessageArea(containerEl)) {
            if (selectionButton) {
              selectionButton.style.display = 'none';
            }
            return;
          }
        }
        
        showSelectionButton(selection!, selectedText);
      } else {
        hideTimeout = window.setTimeout(() => {
          if (selectionButton) {
            selectionButton.style.display = 'none';
          }
        }, 200);
      }
    });

    document.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      const isInCorpusUI = target.closest('.dbx-corpus-selection-btn') || 
                          target.closest('.dbx-corpus-panel') || 
                          target.closest('.dbx-corpus-trigger');
      
      const inPopup = target.closest('.dbx-popup-content');
      
      if (!isInCorpusUI && !this.isInChatMessageArea(target) && !inPopup && selectionButton) {
        selectionButton.style.display = 'none';
      }
    });
  }

  private setupHighlightPersistence(): void {
    this.scheduleHighlightRestore(300);

    this.unsubscribeUrl?.();
    this.unsubscribeUrl = pageLifecycle.onUrlChange(() => {
      void this.handleHighlightConversationChange();
    });

    this.unsubscribeDom?.();
    this.unsubscribeDom = pageLifecycle.onDomChange(() => {
      this.scheduleHighlightRestore(350);
    }, 150);
  }

  private async handleHighlightConversationChange(): Promise<void> {
    textHighlighter.clearRenderedHighlights();
    await this.loadCorpusItems();
    this.updateTriggerCount();
    this.scheduleHighlightRestore(500);
  }

  private scheduleHighlightRestore(delay: number): void {
    if (this.highlightRestoreTimer) {
      clearTimeout(this.highlightRestoreTimer);
    }

    this.highlightRestoreTimer = window.setTimeout(() => {
      this.highlightRestoreTimer = null;
      void textHighlighter.restoreTextHighlights();
    }, delay);
  }

  private flashTriggerButton(): void {
    if (!this.triggerBtn) return;
    
    this.triggerBtn.style.transform = 'scale(1.2)';
    this.triggerBtn.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.3)';
    
    setTimeout(() => {
      if (this.triggerBtn) {
        this.triggerBtn.style.transform = 'scale(1)';
        this.triggerBtn.style.boxShadow = '';
      }
    }, 300);
  }

  private async addToCorpus(text: string): Promise<void> {
    const conversationId = this.getConversationId();
    const conversationTitle = this.getConversationTitle();

    try {
      const item = await storageService.addToCorpusBoard(text, conversationId, conversationTitle);
      this.corpusItems.push(item);
      this.updateTriggerCount();
      
      if (this.isExpanded && this.panel) {
        this.updatePanelContent();
      }
    } catch (error) {
      console.error('[CorpusBoard] Failed to add corpus:', error);
    }
  }

  private async removeCorpusItem(id: string): Promise<void> {
    try {
      await storageService.removeFromCorpusBoard(id);
      this.corpusItems = this.corpusItems.filter(item => item.id !== id);
      this.updateTriggerCount();
      
      if (this.isExpanded && this.panel) {
        this.updatePanelContent();
      }
    } catch (error) {
      console.error('[CorpusBoard] Failed to remove corpus:', error);
    }
  }

  private async clearCorpus(): Promise<void> {
    if (this.corpusItems.length === 0) return;
    const confirmed = await showConfirmDialog({
      title: '清空语料板',
      message: '确定清空当前对话的所有语料吗？',
      confirmText: '清空',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await storageService.clearCorpusBoard(this.getConversationId());
      this.corpusItems = [];
      this.updateTriggerCount();
      showToast('已清空当前对话的语料', 'success');
      
      if (this.isExpanded && this.panel) {
        this.updatePanelContent();
      }
    } catch (error) {
      console.error('[CorpusBoard] Failed to clear corpus:', error);
    }
  }

  private async addToInput(): Promise<void> {
    const selectedItems = this.corpusItems.filter(item => item.selected);
    if (selectedItems.length === 0) return;

    const text = selectedItems.map(item => `[${item.text}]`).join('\n');

    const inputArea = this.findInputArea();
    if (inputArea) {
      const textarea = (inputArea.matches('textarea') ? inputArea : inputArea.querySelector('textarea')) as HTMLTextAreaElement | null;
      const contenteditable = (inputArea.matches('div[contenteditable="true"]') ? inputArea : inputArea.querySelector('div[contenteditable="true"]')) as HTMLElement | null;

      if (textarea) {
        const currentValue = textarea.value;
        textarea.value = currentValue + (currentValue ? '\n' : '') + text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (contenteditable) {
        // 新前端为 Tiptap/ProseMirror，直接改 DOM 会被其 view 覆盖；
        // 聚焦后用 execCommand insertText 触发其内部的输入事件链。
        contenteditable.focus();
        let inserted = false;
        try {
          inserted = document.execCommand('insertText', false, text);
        } catch (e) {
          inserted = false;
        }
        if (!inserted) {
          // 回退：直接写入文本并派发事件（兼容旧版 contenteditable）
          const currentValue = contenteditable.textContent || '';
          contenteditable.textContent = currentValue + (currentValue ? '\n' : '') + text;
          contenteditable.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
      }
    }

    this.corpusItems.forEach(item => {
      item.selected = false;
    });
    this.isExpanded = false;
    this.hidePanel();
  }

  private findInputArea(): HTMLElement | null {
    // 新前端：输入框容器为 #input-engine-container，内部为 div.tiptap.ProseMirror[contenteditable]
    // 旧前端：textarea 或 data-testid="send_textarea"
    const selectors = [
      '#input-engine-container',
      'div.tiptap.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"]',
      '.relative.flex.flex-col-reverse.justify-between.items-end',
      '.flex-col-reverse.items-end.p-10',
      '[class*="flex-col-reverse"][class*="items-end"]',
      '[class*="p-10"][class*="flex-col-reverse"]',
      '[class*="justify-between"][class*="flex-col-reverse"]',
      '[data-testid="send_textarea"]',
      'textarea[placeholder*="发送"]',
      'textarea',
      '[class*="input"]',
      '[class*="composer"]',
      '[class*="chat-input"]'
    ];

    for (const sel of selectors) {
      const el = Array.from(document.querySelectorAll<HTMLElement>(sel)).find((candidate) => {
        if (candidate.closest('#dbx-corpus-panel, #dbx-corpus-trigger')) return false;
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (el) {
        return el;
      }
    }
    return null;
  }

  private getConversationId(): string {
    return getConversationId();
  }

  private getConversationTitle(): string {
    const titleEl = document.querySelector('[class*="title"], [class*="header"] h1, h1');
    return titleEl?.textContent?.trim() || '未知对话';
  }

  destroy(): void {
    if (this.positionResizeHandler) {
      window.removeEventListener('resize', this.positionResizeHandler);
      this.positionResizeHandler = null;
    }
    if (this.highlightPaletteResizeHandler) {
      window.removeEventListener('resize', this.highlightPaletteResizeHandler);
      this.highlightPaletteResizeHandler = null;
    }
    this.unsubscribeDom?.();
    this.unsubscribeDom = null;
    this.unsubscribeUrl?.();
    this.unsubscribeUrl = null;
    if (this.highlightRestoreTimer) {
      clearTimeout(this.highlightRestoreTimer);
      this.highlightRestoreTimer = null;
    }
    if (this.triggerBtn) {
      this.triggerBtn.remove();
      this.triggerBtn = null;
    }
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    this.initialized = false;
  }
}

export const corpusBoard = new CorpusBoard();
