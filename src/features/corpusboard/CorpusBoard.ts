import { storageService, StorageService } from '../../core/services/StorageService';
import type { CorpusItem } from '../../core/types/folder';

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

  init(): void {
    if (this.initialized) return;

    console.log('[CorpusBoard] Initializing...');
    
    this.loadCorpusItems();
    this.createTriggerButton();
    this.setupTextSelectionListener();
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
      this.corpusItems = await storageService.getCorpusBoard();
    } catch (error) {
      console.error('[CorpusBoard] Failed to load corpus items:', error);
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

    this.triggerBtn.addEventListener('click', (e) => {
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
    
    this.panel.innerHTML = `
      <div class="dbx-corpus-header">
        <span class="dbx-corpus-title">语料板</span>
        <span class="dbx-corpus-header-count">${count} 条</span>
        <button class="dbx-corpus-clear-btn" title="清空">清空</button>
      </div>
      <div class="dbx-corpus-list">
        ${this.corpusItems.length === 0 ? '<div class="dbx-corpus-empty">暂无语料<br><small>选中文本后右键添加到语料板</small></div>' : ''}
        ${this.corpusItems.map(item => `
          <div class="dbx-corpus-item" data-id="${item.id}">
            <div class="dbx-corpus-item-content">${this.escapeHtml(item.text)}</div>
            <div class="dbx-corpus-item-meta">
              <span class="dbx-corpus-item-source">${this.escapeHtml(item.conversationTitle || '未知对话')}</span>
              <button class="dbx-corpus-item-remove" title="删除">×</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="dbx-corpus-footer">
        <button class="dbx-corpus-add-btn" ${count === 0 ? 'disabled' : ''}>添加到对话框</button>
      </div>
    `;

    this.updateTriggerCount();

    this.panel.querySelector('.dbx-corpus-clear-btn')?.addEventListener('click', () => {
      this.clearCorpus();
    });

    this.panel.querySelectorAll('.dbx-corpus-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
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
      const rect = range.getBoundingClientRect();
      console.log('[CorpusBoard] Selection rect:', rect);
      
      const container = range.commonAncestorContainer;
      const containerEl = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element;
      
      if (containerEl.closest('.dbx-popup-content')) {
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          添加到语料板
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
        
        selectionButton.addEventListener('click', (e) => {
          e.stopPropagation();
          console.log('[CorpusBoard] Button clicked, saved text:', savedSelectionText);
          if (savedSelectionText) {
            this.addToCorpus(savedSelectionText);
            this.flashTriggerButton();
          }
          selectionButton!.style.display = 'none';
          savedSelectionText = '';
        });

        document.body.appendChild(selectionButton);
      }

      const buttonRect = selectionButton.getBoundingClientRect();
      const left = rect.left + rect.width / 2 - buttonRect.width / 2;
      const top = rect.bottom + 8;

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
    if (this.corpusItems.length === 0) return;

    const text = this.corpusItems.map(item => `[${item.text}]`).join('\n');
    
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
    return urlMatch ? urlMatch[1] : '';
  }

  private getConversationTitle(): string {
    const titleEl = document.querySelector('[class*="title"], [class*="header"] h1, h1');
    return titleEl?.textContent?.trim() || '未知对话';
  }

  destroy(): void {
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
