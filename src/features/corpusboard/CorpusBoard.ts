import { storageService } from '../../core/services/StorageService';
import type { CorpusItem, TextHighlight } from '../../core/types/folder';

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
  private highlightObserver: MutationObserver | null = null;
  private highlightRestoreTimer: number | null = null;
  private highlightUrlTimer: number | null = null;
  private lastHighlightUrl = '';
  private isRestoringHighlights = false;
  private highlightPaletteResizeHandler: (() => void) | null = null;

  init(): void {
    if (this.initialized) return;

    console.log('[CorpusBoard] Initializing...');
    
    this.loadCorpusItems();
    this.createTriggerButton();
    this.setupTextSelectionListener();
    this.setupHighlightPersistence();
    this.initialized = true;
    console.log('[CorpusBoard] Initialized, trigger button:', this.triggerBtn);
    
    setTimeout(() => {
      this.recalculatePosition();
    }, 2000);
  }
  
  private recalculatePosition(): void {
    console.log('[CorpusBoard] Recalculating position after delay...');
    const newPos = this.getDefaultPosition();
    console.log('[CorpusBoard] New default position:', newPos);
    
    console.log('[CorpusBoard] Current position:', { x: this.positionX, y: this.positionY });
    console.log('[CorpusBoard] Should update (newPos.x > 1000):', newPos.x > 1000);
    
    if (newPos.x > 1000) {
      this.positionX = newPos.x;
      this.positionY = newPos.y;
      this.applyTriggerPosition();
      console.log('[CorpusBoard] Position updated to:', newPos);
    } else {
      console.log('[CorpusBoard] Position NOT updated, using current');
    }
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

    console.log('[CorpusBoard] Creating trigger button...');
    console.log('[CorpusBoard] document.body exists:', !!document.body);

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
      <span class="dbx-corpus-count">${this.corpusItems.length}</span>
    `;

    this.applyTriggerPosition();
    this.triggerBtn.style.cssText = this.getTriggerStyles();
    this.triggerBtn.style.display = 'flex';

    console.log('[CorpusBoard] Trigger button created, in DOM:', document.body?.contains(this.triggerBtn));

    this.triggerBtn.addEventListener('click', () => {
      if (!this.isDragging) {
        this.togglePanel();
      }
    });

    this.setupDrag();

    document.body.appendChild(this.triggerBtn);
    console.log('[CorpusBoard] Trigger button appended to body');
  }

  private getTriggerStyles(): string {
    return `
      position: fixed;
      z-index: 9998;
      width: 44px;
      height: 44px;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      color: #666;
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
    console.log('[CorpusBoard] Calculating default position...');
    
    const inputArea = this.findInputArea();
    console.log('[CorpusBoard] inputArea found:', !!inputArea);
    if (inputArea) {
      const rect = inputArea.getBoundingClientRect();
      console.log('[CorpusBoard] inputArea rect:', rect);
      return {
        x: rect.right + 16,
        y: rect.top
      };
    }
    
    const locatorBar = document.querySelector('#dbx-quick-locator');
    console.log('[CorpusBoard] locatorBar found:', !!locatorBar);
    if (locatorBar) {
      const rect = locatorBar.getBoundingClientRect();
      console.log('[CorpusBoard] locatorBar rect:', rect);
      return {
        x: rect.right + 16,
        y: rect.top
      };
    }
    
    const defaultPos = { x: window.innerWidth - 70, y: window.innerHeight - 200 };
    console.log('[CorpusBoard] Using fallback position:', defaultPos);
    return defaultPos;
  }

  private loadPosition(): { x: number; y: number } {
    const defaultPos = this.getDefaultPosition();
    console.log('[CorpusBoard] Default position calculated:', defaultPos);
    
    try {
      const saved = localStorage.getItem('dbx_corpus_trigger_pos');
      console.log('[CorpusBoard] Loaded position from localStorage:', saved);
      if (saved) {
        const pos = JSON.parse(saved);
        const defaultPosIsNearQuickLocator = defaultPos.x > 1000;
        
        if (pos.x >= 0 && pos.x < window.innerWidth && pos.y >= 0 && pos.y < window.innerHeight) {
          if (defaultPosIsNearQuickLocator) {
            console.log('[CorpusBoard] Default is near QuickLocator, using default position');
            return defaultPos;
          }
          console.log('[CorpusBoard] Using saved position:', pos);
          return pos;
        } else {
          console.log('[CorpusBoard] Saved position out of bounds, recalculating');
          localStorage.removeItem('dbx_corpus_trigger_pos');
        }
      }
    } catch (e) {
      console.log('[CorpusBoard] Error loading position:', e);
    }
    console.log('[CorpusBoard] Using default position');
    return defaultPos;
  }

  private savePosition(): void {
    try {
      localStorage.setItem('dbx_corpus_trigger_pos', JSON.stringify({
        x: this.positionX,
        y: this.positionY
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

  private togglePanel(): void {
    this.isExpanded = !this.isExpanded;
    
    if (this.isExpanded) {
      this.createPanel();
      this.updatePanelContent();
    } else {
      this.hidePanel();
    }
  }

  private createPanel(): void {
    if (this.panel) return;

    this.panel = document.createElement('div');
    this.panel.className = 'dbx-corpus-panel';
    this.panel.style.cssText = this.getPanelStyles();
    document.body.appendChild(this.panel);

    document.addEventListener('click', this.handleOutsideClick);
  }

  private getPanelStyles(): string {
    const triggerRect = this.triggerBtn?.getBoundingClientRect();
    const panelWidth = 300;
    const panelHeight = 400;
    
    let left = triggerRect ? triggerRect.left - panelWidth - 8 : this.positionX - panelWidth - 8;
    let top = triggerRect ? triggerRect.top : this.positionY;
    
    if (left < 8) {
      left = triggerRect ? triggerRect.right + 8 : this.positionX + 60;
    }
    if (left + panelWidth > window.innerWidth - 8) {
      left = window.innerWidth - panelWidth - 8;
    }
    if (top < 8) {
      top = triggerRect ? triggerRect.bottom + 8 : this.positionY + 60;
    }
    if (top + panelHeight > window.innerHeight - 8) {
      top = window.innerHeight - panelHeight - 8;
    }

    return `
      position: fixed;
      z-index: 9999;
      left: ${left}px;
      top: ${top}px;
      width: ${panelWidth}px;
      max-height: ${panelHeight}px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
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
        <span class="dbx-corpus-title">语料板</span>
        <span class="dbx-corpus-header-count">${count} 条</span>
        <button class="dbx-corpus-clear-btn" title="清空">清空</button>
      </div>
      <div class="dbx-corpus-list">
        ${this.corpusItems.length === 0 ? '<div class="dbx-corpus-empty">暂无语料<br><small>选中文本后右键添加到语料板</small></div>' : ''}
        ${this.corpusItems.length > 0 ? `
          <div class="dbx-corpus-select-all">
            <input type="checkbox" id="dbx-corpus-select-all" ${selectedCount === count && count > 0 ? 'checked' : ''}>
            <label for="dbx-corpus-select-all">全选</label>
          </div>
        ` : ''}
        ${this.corpusItems.map(item => `
          <div class="dbx-corpus-item ${item.selected ? 'selected' : ''}" data-id="${item.id}">
            <div class="dbx-corpus-item-checkbox">
              <input type="checkbox" ${item.selected ? 'checked' : ''}>
            </div>
            <div class="dbx-corpus-item-body">
              <div class="dbx-corpus-item-content">${this.escapeHtml(item.text)}</div>
            </div>
            <button class="dbx-corpus-item-remove" title="删除">×</button>
          </div>
        `).join('')}
      </div>
      <div class="dbx-corpus-footer">
        <button class="dbx-corpus-add-btn" ${selectedCount === 0 ? 'disabled' : ''}>添加到对话框${selectedCount > 0 ? ` (${selectedCount})` : ''}</button>
      </div>
    `;

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

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private updateTriggerCount(): void {
    const countEl = this.triggerBtn?.querySelector('.dbx-corpus-count');
    if (countEl) {
      countEl.textContent = String(this.corpusItems.length);
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
    let selectedHighlightColor = '#fde047';
    console.log('[CorpusBoard] Setting up text selection listener');

    const showSelectionButton = (selection: Selection, text: string) => {
      console.log('[CorpusBoard] showSelectionButton called', text);
      
      if (!text || text.trim().length === 0) {
        if (selectionButton) {
          selectionButton.style.display = 'none';
        }
        return;
      }

      savedSelectionText = text;
      console.log('[CorpusBoard] Saved selection text:', savedSelectionText);
      
      const range = selection.getRangeAt(0);
      savedSelectionRange = range.cloneRange();
      const rect = range.getBoundingClientRect();
      console.log('[CorpusBoard] Selection rect:', rect);
      
      const container = range.commonAncestorContainer;
      const containerEl = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element;

      if (!containerEl || containerEl.closest('.dbx-popup-content')) {
        console.log('[CorpusBoard] Selection in dbx-popup-content, not showing button');
        return;
      }
      
      const isInChatMessageArea = (el: Element | null): boolean => {
        if (!el) return false;
        const testid = el.getAttribute('data-testid') || '';
        let className = '';
        try {
          className = (el as HTMLElement).className?.toString() || '';
        } catch (e) {
          className = '';
        }
        
        if (testid.includes('message') || 
            testid.includes('message-list') ||
            testid.includes('message_content') ||
            testid.includes('message_text') ||
            className.includes('message-list') ||
            className.includes('message-block')) {
          return true;
        }
        
        if (el.classList.contains('flow-markdown-body') ||
            el.closest('[data-testid="message-list"]')) {
          return true;
        }
        
        return isInChatMessageArea(el.parentElement);
      };
      
      if (!isInChatMessageArea(containerEl)) {
        console.log('[CorpusBoard] Selection not in chat message area, not showing button');
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

  const range = savedSelectionRange.cloneRange();
  const root = this.findHighlightMessageRoot(range.startContainer);
  const highlightData = this.createTextHighlightAnchor(range, color);
  if (!root || !highlightData || !root.contains(range.endContainer)) {
    console.warn('[CorpusBoard] Could not locate the selected message');
    return;
  }

  try {
    await this.removeSelectedHighlightPortions(range.cloneRange());

    const cleanRange = this.createRangeFromTextOffsets(
      root,
      highlightData.startOffset,
      highlightData.endOffset
    );
    if (!cleanRange || cleanRange.toString() !== highlightData.text) {
      console.warn('[CorpusBoard] Could not rebuild the selected range');
      return;
    }

    const marks = this.wrapRangeWithHighlight(cleanRange, color);
    if (marks.length === 0) return;

    const item = await storageService.addTextHighlight(highlightData);
    marks.forEach((mark) => {
      mark.dataset.dbxHighlightId = item.id;
      mark.dataset.dbxConversationId = item.conversationId;
    });
    await storageService.save();

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
  await this.removeSelectedHighlightPortions(savedSelectionRange.cloneRange());

  window.getSelection()?.removeAllRanges();
  selectionButton!.style.display = 'none';
  savedSelectionText = '';
  savedSelectionRange = null;
});

        document.body.appendChild(selectionButton);
      }

      const buttonRect = selectionButton.getBoundingClientRect();
      const left = rect.left + rect.width / 2 - buttonRect.width / 2;
      const top = rect.bottom + 8;
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

      selectionButton.style.left = `${Math.max(8, left)}px`;
      selectionButton.style.top = `${Math.min(top, window.innerHeight - 40)}px`;
      selectionButton.style.display = 'flex';
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
      console.log('[CorpusBoard] mouseup, selection text:', selectedText);
      
      if (selectedText.length > 0) {
        const range = selection!.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const containerEl = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element;
        
        if (containerEl) {
              console.log('[CorpusBoard] Selection container:', containerEl.tagName, containerEl.className);
              
              if (containerEl.closest('.dbx-popup-content')) {
                console.log('[CorpusBoard] Selection in dbx-popup-content');
                if (selectionButton) {
                  selectionButton.style.display = 'none';
                }
                return;
              }
              
              const isInChatMessageArea = (el: Element | null): boolean => {
                if (!el) return false;
                const testid = el.getAttribute('data-testid') || '';
                let className = '';
                try {
                  className = (el as HTMLElement).className?.toString() || '';
                } catch (e) {
                  className = '';
                }
                
                if (testid.includes('message') || 
                    testid.includes('message-list') ||
                    testid.includes('message_content') ||
                    testid.includes('message_text') ||
                    className.includes('message-list') ||
                    className.includes('message-block')) {
                  return true;
                }
                
                if (el.classList.contains('flow-markdown-body') ||
                    el.closest('[data-testid="message-list"]')) {
                  return true;
                }
                
                return isInChatMessageArea(el.parentElement);
              };
              
              if (!isInChatMessageArea(containerEl)) {
                console.log('[CorpusBoard] Selection not in chat message area');
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
      
      const isInChatMessageArea = (el: Element | null): boolean => {
        if (!el) return false;
        const testid = el.getAttribute('data-testid') || '';
        let className = '';
        try {
          className = (el as HTMLElement).className?.toString() || '';
        } catch (e) {
          className = '';
        }
        
        if (testid.includes('message') || 
            testid.includes('message-list') ||
            testid.includes('message_content') ||
            testid.includes('message_text') ||
            className.includes('message-list') ||
            className.includes('message-block')) {
          return true;
        }
        
        if (el.classList.contains('flow-markdown-body') ||
            el.closest('[data-testid="message-list"]')) {
          return true;
        }
        
        return isInChatMessageArea(el.parentElement);
      };
      
      const isInCorpusUI = target.closest('.dbx-corpus-selection-btn') || 
                          target.closest('.dbx-corpus-panel') || 
                          target.closest('.dbx-corpus-trigger');
      
      const inPopup = target.closest('.dbx-popup-content');
      
      if (!isInCorpusUI && !isInChatMessageArea(target) && !inPopup && selectionButton) {
        selectionButton.style.display = 'none';
      }
    });
  }

  private setupHighlightPersistence(): void {
    this.lastHighlightUrl = window.location.href;
    this.scheduleHighlightRestore(300);

    this.highlightObserver = new MutationObserver((mutations) => {
      if (window.location.href !== this.lastHighlightUrl) {
        void this.handleHighlightConversationChange();
        return;
      }

      const hasPageChanges = mutations.some(
        mutation => mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0
      );

      if (hasPageChanges) {
        this.scheduleHighlightRestore(350);
      }
    });

    this.highlightObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.highlightUrlTimer = window.setInterval(() => {
      if (window.location.href !== this.lastHighlightUrl) {
        void this.handleHighlightConversationChange();
      }
    }, 1000);
  }

  private async handleHighlightConversationChange(): Promise<void> {
    this.lastHighlightUrl = window.location.href;
    this.clearRenderedHighlights();
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
      void this.restoreTextHighlights();
    }, delay);
  }

  private async restoreTextHighlights(): Promise<void> {
    if (this.isRestoringHighlights) return;

    const conversationId = this.getConversationId();
    if (conversationId === 'unknown') return;

    this.isRestoringHighlights = true;

    try {
      const highlights = await storageService.getTextHighlights(conversationId);

      for (const highlight of highlights) {
        const alreadyRendered = Array.from(
          document.querySelectorAll<HTMLElement>('.dbx-text-highlight')
        ).some(mark => mark.dataset.dbxHighlightId === highlight.id);

        if (alreadyRendered) continue;

        const root = this.findRootForSavedHighlight(highlight);
        if (!root) continue;

        const startOffset = this.findSavedHighlightOffset(root, highlight);
        if (startOffset === null) continue;

        const range = this.createRangeFromTextOffsets(
          root,
          startOffset,
          startOffset + highlight.text.length
        );
        if (!range || range.toString() !== highlight.text) continue;

        const marks = this.wrapRangeWithHighlight(range, highlight.color);
        if (marks.length === 0) continue;

        marks.forEach((mark) => {
          mark.dataset.dbxHighlightId = highlight.id;
          mark.dataset.dbxConversationId = highlight.conversationId;
        });
      }
    } catch (error) {
      console.error('[CorpusBoard] Failed to restore text highlights:', error);
    } finally {
      this.isRestoringHighlights = false;
    }
  }

  private createTextHighlightAnchor(
    range: Range,
    color: string
  ): Omit<TextHighlight, 'id' | 'createdAt'> | null {
    const root = this.findHighlightMessageRoot(range.startContainer);
    if (!root || !root.contains(range.endContainer)) return null;

    const text = range.toString();
    if (!text) return null;

    try {
      const beforeRange = range.cloneRange();
      beforeRange.selectNodeContents(root);
      beforeRange.setEnd(range.startContainer, range.startOffset);

      const startOffset = beforeRange.toString().length;
      const endOffset = startOffset + text.length;
      const rootText = root.textContent ?? '';
      const roots = this.getHighlightMessageRoots();
      const messageIndex = Math.max(0, roots.indexOf(root));

      return {
        conversationId: this.getConversationId(),
        messageId: this.getHighlightMessageId(root),
        messageIndex,
        text,
        startOffset,
        endOffset,
        prefix: rootText.slice(Math.max(0, startOffset - 48), startOffset),
        suffix: rootText.slice(endOffset, endOffset + 48),
        color,
      };
    } catch (error) {
      console.error('[CorpusBoard] Failed to capture highlight position:', error);
      return null;
    }
  }

  private findHighlightMessageRoot(node: Node): HTMLElement | null {
    const element = node.nodeType === Node.ELEMENT_NODE
      ? node as Element
      : node.parentElement;
    if (!element) return null;

    const contentRoot = element.closest<HTMLElement>(
      '.flow-markdown-body, [data-testid="message_content"], [data-testid="message_text"]'
    );
    if (contentRoot) return contentRoot;

    const messageContainer = element.closest<HTMLElement>(
      '[data-message-id], [data-testid="union_message"], [data-testid="message-block-container"], [class*="message-block"]'
    );
    if (!messageContainer) return null;

    return messageContainer.querySelector<HTMLElement>(
      '.flow-markdown-body, [data-testid="message_content"], [data-testid="message_text"]'
    ) ?? messageContainer;
  }

  private getHighlightMessageRoots(): HTMLElement[] {
    const roots: HTMLElement[] = [];
    const addRoot = (root: HTMLElement): void => {
      if (root.closest('.dbx-corpus-selection-btn, .dbx-corpus-panel')) return;
      if (!roots.includes(root)) {
        roots.push(root);
      }
    };

    document.querySelectorAll<HTMLElement>(
      '[data-message-id], [data-testid="union_message"], [data-testid="message-block-container"]'
    ).forEach((container) => {
      const root = container.querySelector<HTMLElement>(
        '.flow-markdown-body, [data-testid="message_content"], [data-testid="message_text"]'
      ) ?? container;
      addRoot(root);
    });

    document.querySelectorAll<HTMLElement>(
      '.flow-markdown-body, [data-testid="message_content"], [data-testid="message_text"]'
    ).forEach(addRoot);

    return roots;
  }

  private getHighlightMessageId(root: HTMLElement): string | undefined {
    const messageContainer = root.closest<HTMLElement>(
      '[data-testid="union_message"], [data-testid="message-block-container"], [class*="message-block"]'
    );
    const messageElement = root.closest<HTMLElement>('[data-message-id]') ??
      root.querySelector<HTMLElement>('[data-message-id]') ??
      messageContainer?.querySelector<HTMLElement>('[data-message-id]');
    return messageElement?.getAttribute('data-message-id') ?? undefined;
  }

  private findRootForSavedHighlight(highlight: TextHighlight): HTMLElement | null {
    const roots = this.getHighlightMessageRoots();

    if (highlight.messageId) {
      const matchedById = roots.find(
        root => this.getHighlightMessageId(root) === highlight.messageId
      );
      if (matchedById) return matchedById;
    }

    const indexedRoot = roots[highlight.messageIndex];
    if (indexedRoot && this.findSavedHighlightOffset(indexedRoot, highlight) !== null) {
      return indexedRoot;
    }

    return roots.find(
      root => this.findSavedHighlightOffset(root, highlight) !== null
    ) ?? null;
  }

  private findSavedHighlightOffset(
    root: HTMLElement,
    highlight: TextHighlight
  ): number | null {
    const rootText = root.textContent ?? '';
    if (!highlight.text || !rootText.includes(highlight.text)) return null;

    if (
      rootText.slice(highlight.startOffset, highlight.endOffset) === highlight.text
    ) {
      return highlight.startOffset;
    }

    const fullContext = `${highlight.prefix}${highlight.text}${highlight.suffix}`;
    const contextIndex = fullContext ? rootText.indexOf(fullContext) : -1;
    if (contextIndex >= 0) {
      return contextIndex + highlight.prefix.length;
    }

    let bestOffset: number | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let searchFrom = 0;

    while (searchFrom <= rootText.length) {
      const offset = rootText.indexOf(highlight.text, searchFrom);
      if (offset < 0) break;

      const prefixMatches = !highlight.prefix ||
        rootText.slice(Math.max(0, offset - highlight.prefix.length), offset)
          .endsWith(highlight.prefix);
      const suffixMatches = !highlight.suffix ||
        rootText.slice(
          offset + highlight.text.length,
          offset + highlight.text.length + highlight.suffix.length
        ).startsWith(highlight.suffix);
      const distance = Math.abs(offset - highlight.startOffset);
      const score = (prefixMatches ? 1000 : 0) +
        (suffixMatches ? 1000 : 0) -
        distance;

      if (score > bestScore) {
        bestScore = score;
        bestOffset = offset;
      }

      searchFrom = offset + Math.max(1, highlight.text.length);
    }

    return bestOffset;
  }

  private createRangeFromTextOffsets(
    root: HTMLElement,
    startOffset: number,
    endOffset: number
  ): Range | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startNode: Text | null = null;
    let endNode: Text | null = null;
    let startInNode = 0;
    let endInNode = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const nextOffset = currentOffset + node.data.length;

      if (!startNode && startOffset >= currentOffset && startOffset <= nextOffset) {
        startNode = node;
        startInNode = startOffset - currentOffset;
      }

      if (!endNode && endOffset >= currentOffset && endOffset <= nextOffset) {
        endNode = node;
        endInNode = endOffset - currentOffset;
      }

      currentOffset = nextOffset;
      if (startNode && endNode) break;
    }

    if (!startNode || !endNode) return null;

    const range = document.createRange();
    range.setStart(startNode, startInNode);
    range.setEnd(endNode, endInNode);
    return range;
  }

  private getTextPartsInRange(
    range: Range
  ): Array<{ node: Text; startOffset: number; endOffset: number }> {
    const root =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;

    if (!root) return [];

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const parts: Array<{ node: Text; startOffset: number; endOffset: number }> = [];

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;

      try {
        if (!range.intersectsNode(node)) continue;
      } catch {
        continue;
      }

      const startOffset = node === range.startContainer ? range.startOffset : 0;
      const endOffset = node === range.endContainer ? range.endOffset : node.data.length;

      if (endOffset <= startOffset) continue;
      if (!node.data.slice(startOffset, endOffset).trim()) continue;

      parts.push({ node, startOffset, endOffset });
    }

    return parts;
  }

  private wrapRangeWithHighlight(
    range: Range,
    color: string
  ): HTMLElement[] {
    try {
      const parts = this.getTextPartsInRange(range);
      const marks: HTMLElement[] = [];

      [...parts].reverse().forEach(({ node, startOffset, endOffset }) => {
        const mark = document.createElement('mark');
        mark.className = 'dbx-text-highlight';
        mark.style.backgroundColor = color;

        const textRange = document.createRange();
        textRange.setStart(node, startOffset);
        textRange.setEnd(node, endOffset);

        const contents = textRange.extractContents();
        mark.appendChild(contents);
        textRange.insertNode(mark);
        marks.unshift(mark);
      });

      return marks;
    } catch (error) {
      console.error('[CorpusBoard] Failed to wrap highlighted text:', error);
      return [];
    }
  }

  private unwrapHighlight(mark: HTMLElement): void {
    const parent = mark.parentNode;
    if (!parent) return;

    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }

    mark.remove();
    parent.normalize();
  }

  private async removeSelectedHighlightPortions(
    selectionRange: Range
  ): Promise<void> {
    const selectionAnchor = this.createTextHighlightAnchor(selectionRange, '');
    const root = this.findHighlightMessageRoot(selectionRange.startContainer);
    if (!selectionAnchor || !root || !root.contains(selectionRange.endContainer)) {
      return;
    }

    const allMarks = Array.from(
      root.querySelectorAll<HTMLElement>('.dbx-text-highlight')
    );
    const directlySelectedMarks = allMarks.filter((mark) => {
      try {
        return selectionRange.intersectsNode(mark);
      } catch {
        return false;
      }
    });

    if (directlySelectedMarks.length === 0) return;

    try {
      const savedHighlights = await storageService.getTextHighlights(
        selectionAnchor.conversationId
      );
      const highlightsById = new Map(
        savedHighlights.map(highlight => [highlight.id, highlight])
      );
      const remainingSegments: Array<{
        startOffset: number;
        endOffset: number;
        color: string;
      }> = [];
      const removedIds = new Set<string>();
      const marksToUnwrap = new Set<HTMLElement>();

      directlySelectedMarks.forEach((mark) => {
        const id = mark.dataset.dbxHighlightId;
        const highlight = id ? highlightsById.get(id) : undefined;

        if (!id || !highlight) {
          marksToUnwrap.add(mark);
          return;
        }

        if (removedIds.has(id)) return;

        const overlapStart = Math.max(
          highlight.startOffset,
          selectionAnchor.startOffset
        );
        const overlapEnd = Math.min(
          highlight.endOffset,
          selectionAnchor.endOffset
        );

        if (overlapStart >= overlapEnd) return;

        if (highlight.startOffset < overlapStart) {
          remainingSegments.push({
            startOffset: highlight.startOffset,
            endOffset: overlapStart,
            color: highlight.color,
          });
        }

        if (overlapEnd < highlight.endOffset) {
          remainingSegments.push({
            startOffset: overlapEnd,
            endOffset: highlight.endOffset,
            color: highlight.color,
          });
        }

        removedIds.add(id);
      });

      allMarks.forEach((mark) => {
        const id = mark.dataset.dbxHighlightId;
        if (id && removedIds.has(id)) {
          marksToUnwrap.add(mark);
        }
      });

      marksToUnwrap.forEach(mark => this.unwrapHighlight(mark));

      await Promise.all(
        Array.from(removedIds).map(id => storageService.removeTextHighlight(id))
      );

      remainingSegments.sort(
        (a, b) => a.startOffset - b.startOffset
      );

      for (const segment of remainingSegments) {
        if (segment.endOffset <= segment.startOffset) continue;

        const range = this.createRangeFromTextOffsets(
          root,
          segment.startOffset,
          segment.endOffset
        );
        if (!range || !range.toString()) continue;

        const anchor = this.createTextHighlightAnchor(range, segment.color);
        if (!anchor) continue;

        const marks = this.wrapRangeWithHighlight(range, segment.color);
        if (marks.length === 0) continue;

        const item = await storageService.addTextHighlight(anchor);
        marks.forEach((mark) => {
          mark.dataset.dbxHighlightId = item.id;
          mark.dataset.dbxConversationId = item.conversationId;
        });
      }

      await storageService.save();
    } catch (error) {
      console.error('[CorpusBoard] Failed to partially remove highlight:', error);
    }
  }

  private clearRenderedHighlights(): void {
    document
      .querySelectorAll<HTMLElement>('.dbx-text-highlight')
      .forEach(mark => this.unwrapHighlight(mark));
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
    console.log('[CorpusBoard] addToCorpus called with text:', text);
    
    const conversationId = this.getConversationId();
    const conversationTitle = this.getConversationTitle();
    console.log('[CorpusBoard] conversationId:', conversationId, 'conversationTitle:', conversationTitle);

    try {
      console.log('[CorpusBoard] Calling storageService.addToCorpusBoard...');
      const item = await storageService.addToCorpusBoard(text, conversationId, conversationTitle);
      console.log('[CorpusBoard] Item added:', item);
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
    try {
      await storageService.clearCorpusBoard();
      this.corpusItems = [];
      this.updateTriggerCount();
      
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
      const textarea = inputArea.querySelector('textarea');
      const contenteditable = inputArea.querySelector('div[contenteditable="true"]');
      
      if (textarea) {
        const currentValue = textarea.value;
        textarea.value = currentValue + (currentValue ? '\n' : '') + text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (contenteditable) {
        const currentValue = contenteditable.textContent || '';
        contenteditable.textContent = currentValue + (currentValue ? '\n' : '') + text;
        contenteditable.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
    }

    this.corpusItems.forEach(item => {
      item.selected = false;
    });
    this.isExpanded = false;
    this.hidePanel();
  }

  private findInputArea(): HTMLElement | null {
    const selectors = [
      '.relative.flex.flex-col-reverse.justify-between.items-end',
      '.flex-col-reverse.items-end.p-10',
      '[class*="flex-col-reverse"][class*="items-end"]',
      '[class*="p-10"][class*="flex-col-reverse"]',
      '[class*="justify-between"][class*="flex-col-reverse"]',
      '[data-testid="send_textarea"]',
      'textarea[placeholder*="发送"]',
      'div[contenteditable="true"]',
      '[class*="input"]',
      '[class*="composer"]',
      '[class*="chat-input"]'
    ];
    
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        console.log('[CorpusBoard] findInputArea found:', sel);
        return el as HTMLElement;
      }
    }
    console.log('[CorpusBoard] findInputArea: no element found');
    return null;
  }

  private getConversationId(): string {
    const urlMatch = window.location.pathname.match(/\/chat\/([^/?#]+)/);
    return urlMatch ? urlMatch[1] : 'unknown';
  }

  private getConversationTitle(): string {
    const titleEl = document.querySelector('[class*="title"], [class*="header"] h1, h1');
    return titleEl?.textContent?.trim() || '未知对话';
  }

  destroy(): void {
    if (this.highlightPaletteResizeHandler) {
      window.removeEventListener('resize', this.highlightPaletteResizeHandler);
      this.highlightPaletteResizeHandler = null;
    }
    if (this.highlightObserver) {
      this.highlightObserver.disconnect();
      this.highlightObserver = null;
    }
    if (this.highlightRestoreTimer) {
      clearTimeout(this.highlightRestoreTimer);
      this.highlightRestoreTimer = null;
    }
    if (this.highlightUrlTimer) {
      clearInterval(this.highlightUrlTimer);
      this.highlightUrlTimer = null;
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
