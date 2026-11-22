import { storageService } from '../../core/services/StorageService';
import { settingsService } from '../../core/services/SettingsService';
import { pageLifecycle } from '../../core/services/PageLifecycle';

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
  private unsubscribeUrl: (() => void) | null = null;
  private activeScrollContainer: HTMLElement | null = null;
  private scrollSyncHandler: (() => void) | null = null;
  private scrollRafId: number | null = null;
  private scrollAnimRafId: number | null = null;
  private activeMarkerIndex = -1;
  private hasCompletedFullIndex = false;
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
    this.unsubscribeUrl?.();
    this.unsubscribeUrl = pageLifecycle.onUrlChange(() => {
      void this.onConversationChange();
    });
  }

  private async onConversationChange(): Promise<void> {
    const newConversationId = this.getConversationId();
    if (newConversationId !== this.conversationId) {
      this.conversationId = newConversationId;
      
      this.markers = [];
      this.messageCache.clear();
      this.activeMarkerIndex = -1;
      this.hasCompletedFullIndex = false;
      this.cancelScrollAnimation();
      this.detachScrollSync();
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
      const hasMessages = !!container?.querySelector('[data-message-id]');
      if ((container && hasMessages) || retries >= maxRetries) {
        if (container) {
          await this.loadStarredMessages();
          this.createLocatorBar();
          await this.scanMessages(settingsService.getSettings().autoIndexLongChat);
          this.setupObserver();
          this.setupScrollSync(container);
        }
        return;
      }
      retries++;
      setTimeout(checkContainer, 400);
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

    if (indexEntireConversation && (this.isVirtualList(container) || container.scrollHeight > container.clientHeight + 80)) {
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

  private getTopMessageId(container: HTMLElement): string | null {
    return container.querySelector<HTMLElement>('[data-message-id]')?.dataset.messageId ?? null;
  }

  private waitForHistoryLoad(container: HTMLElement, prevHeight: number, prevTopId: string | null, timeoutMs = 420): Promise<boolean> {
    return new Promise((resolve) => {
      const start = performance.now();
      const poll = () => {
        const changed = container.scrollHeight > prevHeight + 8 || this.getTopMessageId(container) !== prevTopId;
        if (changed) {
          window.setTimeout(() => resolve(true), 60);
          return;
        }
        if (performance.now() - start >= timeoutMs) {
          resolve(false);
          return;
        }
        window.setTimeout(poll, 70);
      };
      requestAnimationFrame(poll);
    });
  }

  private async indexEntireConversation(container: HTMLElement): Promise<void> {
    if (this.isIndexing) return;
    this.isIndexing = true;
    const originalScrollTop = container.scrollTop;
    const initialScrollHeight = container.scrollHeight;
    const startConversationId = this.conversationId;
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    window.addEventListener('wheel', cancel, { passive: true, once: true });
    window.addEventListener('pointerdown', cancel, { passive: true, once: true });
    window.addEventListener('touchstart', cancel, { passive: true, once: true });

    const refreshBtn = this.locatorBar?.querySelector<HTMLElement>('.dbx-locator-refresh');
    refreshBtn?.classList.add('is-spinning');

    try {
      this.messageCache.clear();

      // Phase 1: Pull earlier paginated history by reaching the top until no more history loads.
      let stableTopRounds = 0;
      for (let round = 0; round < 25 && !cancelled && this.conversationId === startConversationId; round++) {
        const prevHeight = container.scrollHeight;
        const prevTopId = this.getTopMessageId(container);
        container.scrollTo({ top: 0, behavior: 'auto' });
        const loadedMore = await this.waitForHistoryLoad(container, prevHeight, prevTopId, 420);
        if (cancelled || this.conversationId !== startConversationId) break;
        this.collectVisibleMessages(container);
        if (loadedMore) {
          stableTopRounds = 0;
        } else {
          stableTopRounds++;
          if (stableTopRounds >= 2) break;
        }
      }

      // Phase 2: Sweep from top to bottom so virtualized rows in the middle are all indexed.
      let target = 0;
      let iterations = 0;
      let lastMax = -1;

      while (iterations < 250 && !cancelled && this.conversationId === startConversationId) {
        container.scrollTo({ top: target, behavior: 'auto' });
        await this.waitForVirtualList();
        if (cancelled || this.conversationId !== startConversationId) break;
        this.collectVisibleMessages(container);

        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        if (target >= maxScroll && maxScroll === lastMax) break;
        lastMax = maxScroll;
        const step = Math.max(360, container.clientHeight * 0.8);
        target = Math.min(maxScroll, target + step);
        iterations++;
      }

      if (!cancelled && this.conversationId === startConversationId) {
        this.hasCompletedFullIndex = true;
      }
    } finally {
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('pointerdown', cancel);
      window.removeEventListener('touchstart', cancel);
      refreshBtn?.classList.remove('is-spinning');
      if (!cancelled && this.conversationId === startConversationId) {
        // Preserve the user's visual reading position even when earlier history prepended above.
        const heightDelta = Math.max(0, container.scrollHeight - initialScrollHeight);
        container.scrollTo({ top: originalScrollTop + heightDelta, behavior: 'auto' });
        await this.waitForVirtualList();
      }
      if (this.conversationId === startConversationId) {
        this.collectVisibleMessages(container);
        this.rebuildMarkers();
        this.updateLocatorDots();
        this.syncActiveMarkerFromScroll(container);
      }
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
      <button type="button" class="dbx-locator-refresh" title="加载全部历史定位点" aria-label="加载全部历史定位点">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
          <polyline points="21 3 21 9 15 9"/>
        </svg>
      </button>
      <div class="dbx-locator-track"></div>
    `;

    bar.querySelector('.dbx-locator-refresh')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = this.scrollContainer;
      if (container) {
        void this.indexEntireConversation(container);
      }
    });
    
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
      this.tooltipEl.style.cssText = 'position: fixed; z-index: 99999; background: var(--dbx-surface, #fff); color: var(--dbx-text-primary, #333); border: 1px solid var(--dbx-border, transparent); padding: 10px 12px; border-radius: 10px; font-size: 13px; box-shadow: var(--dbx-shadow-lg, 0 4px 20px rgba(0, 0, 0, 0.15)); width: 240px; height: 90px; display: none; flex-direction: column; gap: 8px; overflow: hidden;';
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
      text.style.cssText = 'color: var(--dbx-text-primary, #333); line-height: 1.4; height: 54px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; word-wrap: break-word; word-break: break-all;';
      this.tooltipEl.appendChild(text);
    }
    
    let starBtn = this.tooltipEl.querySelector('.tooltip-star') as HTMLButtonElement;
    if (!starBtn) {
      starBtn = document.createElement('button');
      starBtn.className = 'tooltip-star';
      starBtn.style.cssText = 'display: flex; align-items: center; justify-content: flex-start; gap: 6px; padding: 6px 8px; margin: 0 -4px; border-radius: 6px; font-size: 12px; color: var(--dbx-text-secondary, #666); cursor: pointer; background: transparent; border: none; width: fit-content;';
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
            await storageService.addStarredMessage(this.conversationId, marker.index, {
              messageId: marker.messageId,
              text: marker.text,
            });
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

  private cancelScrollAnimation(): void {
    if (this.scrollAnimRafId !== null) {
      window.cancelAnimationFrame(this.scrollAnimRafId);
      this.scrollAnimRafId = null;
    }
  }

  private getCenteredScrollTop(container: HTMLElement, element: HTMLElement): number {
    const containerRect = container.getBoundingClientRect();
    const elRect = element.getBoundingClientRect();
    const target = container.scrollTop + (elRect.top - containerRect.top) - Math.max(24, (container.clientHeight - elRect.height) * 0.35);
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    return Math.max(0, Math.min(maxScroll, target));
  }

  private smoothScrollContainerTo(
    container: HTMLElement,
    initialTargetTop: number,
    resolveLiveTarget?: () => number | null
  ): Promise<boolean> {
    this.cancelScrollAnimation();

    return new Promise((resolve) => {
      const startTop = container.scrollTop;
      let targetTop = initialTargetTop;
      const distance = Math.abs(targetTop - startTop);
      if (distance < 4) {
        resolve(true);
        return;
      }

      const duration = Math.min(620, Math.max(280, 240 + Math.sqrt(distance) * 5.5));
      const startTime = performance.now();
      let cancelled = false;

      const onUserInterrupt = () => {
        cancelled = true;
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        this.cancelScrollAnimation();
        window.removeEventListener('wheel', onUserInterrupt);
        window.removeEventListener('pointerdown', onUserInterrupt);
        window.removeEventListener('touchstart', onUserInterrupt);
      };

      window.addEventListener('wheel', onUserInterrupt, { passive: true, once: true });
      window.addEventListener('pointerdown', onUserInterrupt, { passive: true, once: true });
      window.addEventListener('touchstart', onUserInterrupt, { passive: true, once: true });

      const step = (now: number) => {
        if (cancelled) return;
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Smooth easeInOutCubic so every jump glides naturally like scrolling up/down.
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        if (resolveLiveTarget) {
          const live = resolveLiveTarget();
          if (live !== null) {
            targetTop = live;
          }
        }

        container.scrollTop = startTop + (targetTop - startTop) * eased;

        if (progress < 1) {
          this.scrollAnimRafId = window.requestAnimationFrame(step);
        } else {
          container.scrollTop = targetTop;
          cleanup();
          resolve(true);
        }
      };

      this.scrollAnimRafId = window.requestAnimationFrame(step);
    });
  }

  private async scrollToMessage(marker: MessageMarker): Promise<void> {
    const container = this.scrollContainer;
    if (!container) return;

    this.scrollLocatorToMarker(marker.index);
    this.setActiveMarker(marker.index);

    const resolveElement = (): HTMLElement | null => {
      if (marker.element?.isConnected) return marker.element;
      const found = this.findMessageElement(marker.messageId);
      if (found) marker.element = found;
      return found;
    };

    const existing = resolveElement();
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const estimatedTop = Math.max(
      0,
      Math.min(maxScroll, marker.scrollTop - container.clientHeight * 0.35)
    );
    const initialTarget = existing
      ? this.getCenteredScrollTop(container, existing)
      : estimatedTop;

    const completed = await this.smoothScrollContainerTo(
      container,
      initialTarget,
      () => {
        const el = resolveElement();
        return el ? this.getCenteredScrollTop(container, el) : null;
      }
    );
    if (!completed) return;

    let element = resolveElement();
    for (let attempt = 0; attempt < 8 && !element; attempt++) {
      await this.waitForVirtualList();
      element = resolveElement();
    }
    if (!element) return;

    // Gentle settle if virtual row height differed slightly from estimated offset.
    const settledTop = this.getCenteredScrollTop(container, element);
    if (Math.abs(container.scrollTop - settledTop) > 28) {
      await this.smoothScrollContainerTo(container, settledTop);
    }

    element.classList.add('dbx-message-highlight');
    setTimeout(() => {
      element?.classList.remove('dbx-message-highlight');
    }, 2000);
  }

  private setupScrollSync(container: HTMLElement): void {
    this.detachScrollSync();
    this.activeScrollContainer = container;
    this.scrollSyncHandler = () => {
      if (this.isIndexing || this.scrollRafId !== null) return;
      this.scrollRafId = window.requestAnimationFrame(() => {
        this.scrollRafId = null;
        this.syncActiveMarkerFromScroll(container);
      });
    };
    container.addEventListener('scroll', this.scrollSyncHandler, { passive: true });
    this.syncActiveMarkerFromScroll(container);
  }

  private detachScrollSync(): void {
    if (this.activeScrollContainer && this.scrollSyncHandler) {
      this.activeScrollContainer.removeEventListener('scroll', this.scrollSyncHandler);
    }
    this.activeScrollContainer = null;
    this.scrollSyncHandler = null;
    if (this.scrollRafId !== null) {
      window.cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }
  }

  private syncActiveMarkerFromScroll(container: HTMLElement): void {
    if (!this.markers.length) return;
    const viewportMid = container.scrollTop + container.clientHeight * 0.35;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.markers.length; i++) {
      const distance = Math.abs(this.markers[i].scrollTop - viewportMid);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    this.setActiveMarker(bestIndex);
  }

  private setActiveMarker(index: number): void {
    if (index === this.activeMarkerIndex || !this.locatorBar) return;
    const prev = this.locatorBar.querySelector<HTMLElement>('.dbx-locator-dot.active');
    prev?.classList.remove('active');
    const next = this.locatorBar.querySelector<HTMLElement>(`.dbx-locator-dot[data-marker-index="${index}"]`);
    next?.classList.add('active');
    this.activeMarkerIndex = index;
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
    const shouldFullIndex = !this.hasCompletedFullIndex && settingsService.getSettings().autoIndexLongChat;
    await this.scanMessages(shouldFullIndex);
  }, 1000);

  private debounce(fn: () => void | Promise<void>, delay: number): () => void {
    let timer: number | null = null;
    return () => {
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(fn, delay);
    };
  }

  destroy(): void {
    this.cancelScrollAnimation();
    this.detachScrollSync();
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.unsubscribeUrl?.();
    this.unsubscribeUrl = null;
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
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
