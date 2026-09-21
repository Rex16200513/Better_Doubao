import { storageService } from '../../core/services/StorageService';

export interface MessageMarker {
  id: string;
  messageId: string;
  element: HTMLElement | null;
  scrollTop: number;
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
  private conversationId: string = 'unknown';
  private messageCache = new Map<string, Omit<MessageMarker, 'id' | 'index' | 'starred'>>();
  private isIndexing = false;

  private get scrollContainer(): HTMLElement | null {
    const selectors = [
      '[class*="v_list_scroller"]',
      '[data-testid="flow_chat_page"] [class*="scroller"]',
      '[class*="chat-container"]',
      '[data-testid="flow_chat_page"]',
      'main',
      '[class*="page-main"]',
    ];
    for (const selector of selectors) {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) return element;
    }
    return null;
  }

  init(): void {
    if (this.initialized) return;
    
    this.conversationId = this.getConversationId();
    this.loadStarredMessages();
    this.waitForChatContainer();
    this.setupUrlChangeListener();
    this.initialized = true;
  }

  private setupUrlChangeListener(): void {
    let lastUrl = window.location.href;
    new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        this.onConversationChange();
      }
    }).observe(document.body, { childList: true, subtree: true });
    
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        this.onConversationChange();
      }
    }, 1000);
  }

  private async onConversationChange(): Promise<void> {
    const newConversationId = this.getConversationId();
    if (newConversationId !== this.conversationId) {
      this.conversationId = newConversationId;
      
      this.markers = [];
      this.messageCache.clear();
      this.observer?.disconnect();
      this.observer = null;
      if (this.locatorBar) {
        this.locatorBar.remove();
        this.locatorBar = null;
      }
      
      await this.loadStarredMessages();
      await this.waitForChatContainer();
    }
  }

  private getConversationId(): string {
    const urlMatch = window.location.pathname.match(/\/chat\/([^/?#]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    return 'unknown';
  }

  private async waitForChatContainer(): Promise<void> {
    let retries = 0;
    const maxRetries = 30;
    
    const checkContainer = async () => {
      const container = this.scrollContainer;
      if (container || retries >= maxRetries) {
        if (container) {
          await this.loadStarredMessages();
          await this.scanMessages(true);
          this.createLocatorBar();
          this.setupObserver();
        }
        return;
      }
      retries++;
      setTimeout(checkContainer, 500);
    };
    
    checkContainer();
  }

  private async loadStarredMessages(): Promise<void> {
    if (!this.conversationId || this.conversationId === 'unknown') {
      return;
    }
    
    try {
      this.starredMarkers = new Set();
      const starred = await storageService.getStarredMessages(this.conversationId);
      this.starredMarkers = new Set(starred);
    } catch (error) {
    }
  }

  private async scanMessages(indexEntireConversation = false): Promise<void> {
    const container = this.scrollContainer;
    if (!container) {
      return;
    }

    this.conversationId = this.getConversationId();
    await this.loadStarredMessages();

    if (indexEntireConversation && this.isVirtualList(container)) {
      await this.indexEntireConversation(container);
    } else {
      this.collectVisibleMessages(container);
      this.rebuildMarkers();
    }

    this.updateLocatorDots();
  }

  private isVirtualList(container: HTMLElement): boolean {
    return container.matches('[class*="v_list_scroller"]') || !!container.querySelector('.v_list_row, [data-name="scroll_holder"]');
  }

  private collectVisibleMessages(container: HTMLElement): void {
    const messageElements = Array.from(container.querySelectorAll<HTMLElement>('[data-message-id]'));
    let prevWasUser = false;

    messageElements.forEach((el) => {
      // 新前端 data-message-id 元素本身即消息根；旧前端需向上找到 inner-item 容器
      const root = el.closest<HTMLElement>('.inner-item-BjaxFt, .inner-item-w21SQO, [data-testid="union_message"], [data-testid="message-block-container"]') || el;

      const html = root.innerHTML?.toLowerCase() || '';
      const hasSendClass = html.includes('send_message') ||
        html.includes('send-msg') ||
        html.includes('user-bubble') ||
        html.includes('bubble-bg');

      const hasBubble = root.querySelector('.bg-g-send-msg-bubble-bg, [class*="send-msg"], [class*="send_message"], [class*="user-bubble"], [class*="bubble-bg"], .content-KTJ1Rj, [class*="text-g-send-msg-bubble-text"]');

      const hasUserImageBlock = root.querySelector('[data-plugin-identifier*="block_type:10052"]');
      const hasJustifyEnd = root.querySelector('[class*="justify-end"]');

      const isUser = hasSendClass || hasBubble || (hasUserImageBlock && hasJustifyEnd);

      if (isUser) {
        if (!prevWasUser) {
          const messageId = el.dataset.messageId;
          if (messageId) {
            const row = el.closest<HTMLElement>('.v_list_row');
            const rowOffset = this.getVirtualRowOffset(row);
            const text = this.extractMessageText(root) || '[媒体消息]';
            this.messageCache.set(messageId, {
              messageId,
              element: root,
              scrollTop: rowOffset ?? Math.max(0, container.scrollTop + root.getBoundingClientRect().top - container.getBoundingClientRect().top),
              text,
            });
          }
        }
        prevWasUser = true;
      } else {
        prevWasUser = false;
      }
    });
  }

  private getVirtualRowOffset(row: HTMLElement | null): number | null {
    if (!row) return null;
    const value = row.style.getPropertyValue('--vlist-row-transform-y');
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : row.offsetTop;
  }

  private rebuildMarkers(): void {
    const cached = Array.from(this.messageCache.values()).sort((a, b) => a.scrollTop - b.scrollTop);
    this.markers = cached.map((entry, index) => {
      return {
        id: `marker_${index}`,
        ...entry,
        index,
        starred: this.starredMarkers.has(index),
      };
    });
  }

  private async indexEntireConversation(container: HTMLElement): Promise<void> {
    if (this.isIndexing) return;
    this.isIndexing = true;
    const originalScrollTop = container.scrollTop;

    try {
      this.messageCache.clear();
      let target = 0;
      let iterations = 0;
      let lastMax = -1;

      while (iterations < 250) {
        container.scrollTo({ top: target, behavior: 'auto' });
        await this.waitForVirtualList();
        this.collectVisibleMessages(container);

        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        if (target >= maxScroll && maxScroll === lastMax) break;
        lastMax = maxScroll;
        const step = Math.max(320, container.clientHeight * 0.75);
        target = Math.min(maxScroll, target + step);
        iterations++;
      }
    } finally {
      container.scrollTo({ top: originalScrollTop, behavior: 'auto' });
      await this.waitForVirtualList();
      this.collectVisibleMessages(container);
      this.rebuildMarkers();
      this.isIndexing = false;
    }
  }

  private waitForVirtualList(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(resolve, 40)));
    });
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
    
    if (!text) {
      const hasImage = clone.querySelector('img') || 
                       clone.querySelector('[class*="image"]') ||
                       clone.querySelector('[data-testid*="image"]') ||
                       clone.innerHTML.includes('imagex-type');
      if (hasImage) {
        return '[图片]';
      }
    }
    
    if (text.length > 40) {
      return text.substring(0, 40) + '...';
    }
    return text;
  }

  private createLocatorBar(): void {
    if (this.locatorBar) return;

    const bar = document.createElement('div');
    bar.id = 'dbx-quick-locator';
    bar.innerHTML = `
      <div class="dbx-locator-track"></div>
    `;
    
    document.body.appendChild(bar);
    this.locatorBar = bar;
    this.updateLocatorDots();
  }

  private updateLocatorDots(): void {
    if (!this.locatorBar) return;
    
    const track = this.locatorBar.querySelector('.dbx-locator-track');
    if (!track) return;

    const previousScrollTop = track.scrollTop;
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
        void this.scrollToMessage(marker);
      });

      track.appendChild(dot);
    });
    track.scrollTop = previousScrollTop;
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
        } catch (error) {
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

  private async scrollToMessage(marker: MessageMarker): Promise<void> {
    const container = this.scrollContainer;
    if (!container) return;

    let element = marker.element?.isConnected ? marker.element : this.findMessageElement(marker.messageId);
    if (!element) {
      container.scrollTo({ top: marker.scrollTop, behavior: 'auto' });
      for (let attempt = 0; attempt < 12 && !element; attempt++) {
        await this.waitForVirtualList();
        element = this.findMessageElement(marker.messageId);
      }
    }
    if (!element) return;

    marker.element = element;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('dbx-message-highlight');
    setTimeout(() => {
      element?.classList.remove('dbx-message-highlight');
    }, 2000);
    
    this.scrollLocatorToMarker(marker.index);
  }

  private findMessageElement(messageId: string): HTMLElement | null {
    const node = Array.from(document.querySelectorAll<HTMLElement>('[data-message-id]'))
      .find((el) => el.dataset.messageId === messageId);
    return node?.closest<HTMLElement>('.inner-item-BjaxFt, .inner-item-w21SQO, [data-testid="union_message"], [data-testid="message-block-container"]') || node || null;
  }
  
  private scrollLocatorToMarker(index: number): void {
    const track = this.locatorBar?.querySelector('.dbx-locator-track');
    if (!track) return;
    
    const dots = track.querySelectorAll('.dbx-locator-dot');
    const targetDot = dots[index] as HTMLElement;
    if (!targetDot) return;
    
    const trackRect = track.getBoundingClientRect();
    const dotRect = targetDot.getBoundingClientRect();
    
    const trackHeight = trackRect.height;
    const dotTop = dotRect.top - trackRect.top;
    const dotCenter = dotTop + dotRect.height / 2;
    const scrollTarget = track.scrollTop + dotCenter - trackHeight / 2;
    
    track.scrollTo({
      top: scrollTarget,
      behavior: 'smooth'
    });
  }

  private setupObserver(): void {
    const container = this.scrollContainer;
    if (!container) return;

    this.observer?.disconnect();
    this.observer = new MutationObserver((mutations) => {
      if (this.isIndexing) return;
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

  private debounceScan = this.debounce(async () => {
    await this.scanMessages(false);
  }, 1000);

  private debounce(fn: () => void | Promise<void>, delay: number): () => void {
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
    this.messageCache.clear();
    this.initialized = false;
  }
}

export const quickLocator = new QuickLocator();
