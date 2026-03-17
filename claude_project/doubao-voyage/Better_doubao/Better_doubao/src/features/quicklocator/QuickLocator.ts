import { storageService } from '../../core/services/StorageService';

export interface MessageMarker {
  id: string;
  element: HTMLElement;
  text: string;
  index: number;
  starred: boolean;
}

export class QuickLocator {
  private markers: MessageMarker[] = [];
  private locatorBar: HTMLElement | null = null;
  private initialized = false;
  private observer: MutationObserver | null = null;
  private starredMarkers: Set<number> = new Set();
  private conversationId: string = '';

  private get scrollContainer(): HTMLElement | null {
    return document.querySelector('[data-testid="flow_chat_page"], [class*="chat-container"], main, [class*="page-main"]') as HTMLElement;
  }

  init(): void {
    if (this.initialized) return;
    
    this.conversationId = this.getConversationId();
    console.log('[QuickLocator] Conversation ID:', this.conversationId);
    
    this.waitForChatContainer();
    this.initialized = true;
  }

  private getConversationId(): string {
    const urlMatch = window.location.pathname.match(/\/chat\/([^/?#]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    return '';
  }

  private async waitForChatContainer(): Promise<void> {
    let retries = 0;
    const maxRetries = 30;
    
    const checkContainer = async () => {
      const container = this.scrollContainer;
      if (container || retries >= maxRetries) {
        if (container) {
          console.log('[QuickLocator] Chat container found, scanning messages...');
          await this.loadStarredMessages();
          this.scanMessages();
          this.createLocatorBar();
          this.setupObserver();
        } else {
          console.log('[QuickLocator] Chat container not found after max retries');
        }
        return;
      }
      retries++;
      setTimeout(checkContainer, 500);
    };
    
    checkContainer();
  }

  private async loadStarredMessages(): Promise<void> {
    if (!this.conversationId) {
      console.log('[QuickLocator] No conversation ID, skipping starred messages load');
      return;
    }
    
    try {
      const starred = await storageService.getStarredMessages(this.conversationId);
      this.starredMarkers = new Set(starred);
      console.log('[QuickLocator] Loaded starred messages:', this.starredMarkers);
    } catch (error) {
      console.error('[QuickLocator] Failed to load starred messages:', error);
    }
  }

  private scanMessages(): void {
    const container = this.scrollContainer;
    if (!container) {
      console.log('[QuickLocator] scrollContainer not found');
      return;
    }

    const messageContents = container.querySelectorAll('[data-testid="message_text_content"]');
    console.log('[QuickLocator] Found message contents:', messageContents.length);
    
    const userMessages: HTMLElement[] = [];
    
    messageContents.forEach((el) => {
      const parent = el.closest('[data-testid="union_message"]') || el.closest('[class*="item"]');
      if (parent && !userMessages.includes(parent as HTMLElement)) {
        const html = parent.innerHTML?.toLowerCase() || '';
        if (!html.includes('receive_message')) {
          userMessages.push(parent as HTMLElement);
        }
      }
    });

    console.log('[QuickLocator] Found user messages:', userMessages.length);

    this.markers = userMessages.slice(0, 20).map((el, index) => {
      const text = this.extractMessageText(el);
      return {
        id: `marker_${index}`,
        element: el,
        text: text || `问题 ${index + 1}`,
        index,
        starred: this.starredMarkers.has(index),
      };
    }).filter(m => m.text && m.text.length > 0);

    console.log('[QuickLocator] Found markers:', this.markers.length);
    this.updateLocatorDots();
  }

  private extractMessageText(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement;
    
    const removeSelectors = [
      'svg', 'button', '[class*="avatar"]', '[class*="time"]', 
      '[class*="timestamp"]', '[class*="meta"]', '[class*="action"]',
      '[class*="toolbar"]', '[data-testid*="action"]'
    ];
    removeSelectors.forEach(sel => {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    });

    let text = clone.textContent?.trim() || '';
    text = text.replace(/\s+/g, ' ').trim();
    
    if (text.length > 40) {
      return text.substring(0, 40) + '...';
    }
    return text;
  }

  private createLocatorBar(): void {
    if (this.locatorBar) return;

    console.log('[QuickLocator] Creating locator bar');
    
    const bar = document.createElement('div');
    bar.id = 'dbx-quick-locator';
    bar.innerHTML = `
      <div class="dbx-locator-track"></div>
    `;
    
    document.body.appendChild(bar);
    this.locatorBar = bar;
    console.log('[QuickLocator] Locator bar created, markers:', this.markers.length);
    this.updateLocatorDots();
  }

  private updateLocatorDots(): void {
    if (!this.locatorBar) return;
    
    const track = this.locatorBar.querySelector('.dbx-locator-track');
    if (!track) return;

    track.innerHTML = '';

    this.markers.forEach((marker, index) => {
      const dot = document.createElement('button');
      dot.className = 'dbx-locator-dot' + (marker.starred ? ' starred' : '');
      dot.setAttribute('data-marker-index', String(index));
      dot.setAttribute('data-marker-text', marker.text);
      
      dot.addEventListener('mouseenter', (e) => {
        this.showTooltip(e.target as HTMLElement, marker);
      });
      
      dot.addEventListener('mouseleave', (e) => {
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (!this.tooltipEl || !this.tooltipEl.contains(relatedTarget)) {
          this.hideTooltip();
        }
      });
      
      dot.addEventListener('click', () => {
        this.scrollToMessage(marker);
      });

      track.appendChild(dot);
    });
  }

  private tooltipEl: HTMLElement | null = null;
  private hideTooltipTimeout: number | null = null;

  private showTooltip(dot: HTMLElement, marker: MessageMarker): void {
    if (this.hideTooltipTimeout) {
      clearTimeout(this.hideTooltipTimeout);
      this.hideTooltipTimeout = null;
    }
    
    if (!this.tooltipEl) {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.id = 'dbx-locator-tooltip-floating';
      this.tooltipEl.style.cssText = 'position: fixed; z-index: 99999; background: #fff; color: #333; padding: 10px 12px; border-radius: 10px; font-size: 13px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); width: 240px; height: 90px; display: none; flex-direction: column; gap: 8px; overflow: hidden;';
      document.body.appendChild(this.tooltipEl);
      
      this.tooltipEl.addEventListener('mouseenter', () => {
        if (this.hideTooltipTimeout) {
          clearTimeout(this.hideTooltipTimeout);
          this.hideTooltipTimeout = null;
        }
      });
      this.tooltipEl.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
    }
    
    const textEl = this.tooltipEl.querySelector('.tooltip-text');
    if (textEl) {
      textEl.textContent = marker.text;
    } else {
      const text = document.createElement('div');
      text.className = 'tooltip-text';
      text.textContent = marker.text;
      text.style.cssText = 'color: #333; line-height: 1.4; height: 54px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; word-wrap: break-word; word-break: break-all;';
      this.tooltipEl.appendChild(text);
    }
    
    let starBtn = this.tooltipEl.querySelector('.tooltip-star') as HTMLButtonElement;
    if (!starBtn) {
      starBtn = document.createElement('button');
      starBtn.className = 'tooltip-star';
      starBtn.style.cssText = 'display: flex; align-items: center; justify-content: flex-start; gap: 6px; padding: 6px 8px; margin: 0 -4px; border-radius: 6px; font-size: 12px; color: #666; cursor: pointer; background: transparent; border: none; width: fit-content;';
      this.tooltipEl.appendChild(starBtn);
    }
    starBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="${marker.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
      ${marker.starred ? '已收藏' : '收藏'}
    `;
    starBtn.onclick = async (e) => {
      e.stopPropagation();
      const isNowStarred = !marker.starred;
      
      starBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="${isNowStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        ${isNowStarred ? '已收藏' : '收藏'}
      `;
      starBtn.style.color = isNowStarred ? '#f59e0b' : '#666';
      
      const dot = this.locatorBar?.querySelector(`[data-marker-index="${marker.index}"]`) as HTMLElement;
      if (dot) {
        dot.classList.toggle('starred', isNowStarred);
      }
      
      if (this.starredMarkers.has(marker.index)) {
        this.starredMarkers.delete(marker.index);
      } else {
        this.starredMarkers.add(marker.index);
      }
      this.markers[marker.index].starred = isNowStarred;
      
      if (this.conversationId) {
        try {
          if (isNowStarred) {
            await storageService.addStarredMessage(this.conversationId, marker.index);
          } else {
            await storageService.removeStarredMessage(this.conversationId, marker.index);
          }
          console.log('[QuickLocator] Saved starred message:', marker.index, isNowStarred);
        } catch (error) {
          console.error('[QuickLocator] Failed to save starred message:', error);
        }
      }
    };
    
    const rect = dot.getBoundingClientRect();
    this.tooltipEl.style.display = 'flex';
    this.tooltipEl.style.left = (rect.left - 240) + 'px';
    this.tooltipEl.style.top = (rect.top + rect.height / 2 - 35) + 'px';
  }

  private hideTooltip(): void {
    if (this.hideTooltipTimeout) return;
    
    this.hideTooltipTimeout = window.setTimeout(() => {
      if (this.tooltipEl) {
        this.tooltipEl.style.display = 'none';
      }
      this.hideTooltipTimeout = null;
    }, 150);
  }

  private scrollToMessage(marker: MessageMarker): void {
    if (!marker.element) return;

    marker.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    marker.element.classList.add('dbx-message-highlight');
    setTimeout(() => {
      marker.element.classList.remove('dbx-message-highlight');
    }, 2000);
  }

  private setupObserver(): void {
    const container = this.scrollContainer;
    if (!container) return;

    this.observer = new MutationObserver((mutations) => {
      let shouldRescan = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldRescan = true;
          break;
        }
      }
      
      if (shouldRescan) {
        this.debounceScan();
      }
    });

    this.observer.observe(container, { childList: true, subtree: true });
  }

  private debounceScan = this.debounce(() => {
    this.scanMessages();
    this.updateLocatorDots();
  }, 1000);

  private debounce(fn: () => void, delay: number): () => void {
    let timer: number | null = null;
    return () => {
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(fn, delay);
    };
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.locatorBar) {
      this.locatorBar.remove();
      this.locatorBar = null;
    }
    this.markers = [];
    this.initialized = false;
  }
}

export const quickLocator = new QuickLocator();
