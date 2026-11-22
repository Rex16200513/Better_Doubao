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

const STAR_SVG = (filled: boolean) => `
  <svg width="13" height="13" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
`;

const REFRESH_SVG = `
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
    <polyline points="21 3 21 9 15 9"/>
  </svg>
`;

export class QuickLocator {
  private markers: MessageMarker[] = [];
  private locatorBar: HTMLElement | null = null;
  private popoverEl: HTMLElement | null = null;
  private hidePopoverTimer: number | null = null;
  private filterStarredOnly = false;
  private hoveredIndex = -1;
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
      const element = Array.from(document.querySelectorAll<HTMLElement>(selector))
        .find((el) => !el.dataset.dbxFreezeSnapshot);
      if (element) return element;
    }
    return null;
  }

  init(): void {
    if (this.initialized) return;

    this.conversationId = this.getConversationId();
    void this.loadStarredMessages();
    void this.waitForChatContainer();
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
      this.hoveredIndex = -1;
      this.filterStarredOnly = false;
      this.hasCompletedFullIndex = false;
      this.cancelScrollAnimation();
      this.detachScrollSync();
      this.observer?.disconnect();
      this.observer = null;
      this.hidePopoverImmediate();
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
      window.setTimeout(checkContainer, 350);
    };

    void checkContainer();
  }

  private async loadStarredMessages(): Promise<void> {
    if (!this.conversationId || this.conversationId === 'unknown') {
      return;
    }

    try {
      this.starredMarkers = new Set();
      const starred = await storageService.getStarredMessages(this.conversationId);
      this.starredMarkers = new Set(starred);
    } catch {
      // Ignore storage read failure
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
    this.markers = cached.map((entry, index) => ({
      id: `marker_${index}`,
      ...entry,
      index,
      starred: this.starredMarkers.has(index),
    }));
  }

  private resolveOpaqueBackground(el: HTMLElement): string {
    let cur: HTMLElement | null = el;
    while (cur) {
      const bg = getComputedStyle(cur).backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
        return bg;
      }
      cur = cur.parentElement;
    }
    return 'var(--dbx-surface, #ffffff)';
  }

  /**
   * Place a pixel-aligned static clone over the scroll viewport so the user sees a completely
   * steady page while the underlying container rapidly loads and indexes virtualized history.
   */
  private mountFreezeSnapshot(container: HTMLElement, scrollTop: number): HTMLElement | null {
    const parent = container.parentElement;
    if (!parent) return null;
    const rect = container.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return null;

    const snapshot = container.cloneNode(true) as HTMLElement;
    snapshot.dataset.dbxFreezeSnapshot = 'true';
    snapshot.setAttribute('aria-hidden', 'true');
    snapshot.removeAttribute('id');
    snapshot.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    snapshot.querySelectorAll('[data-message-id]').forEach((node) => node.removeAttribute('data-message-id'));

    snapshot.style.position = 'fixed';
    snapshot.style.left = `${rect.left}px`;
    snapshot.style.top = `${rect.top}px`;
    snapshot.style.width = `${rect.width}px`;
    snapshot.style.height = `${rect.height}px`;
    snapshot.style.margin = '0';
    snapshot.style.zIndex = '9990';
    snapshot.style.pointerEvents = 'none';
    snapshot.style.overflow = 'hidden';
    snapshot.style.background = this.resolveOpaqueBackground(container);

    parent.appendChild(snapshot);
    snapshot.scrollTop = scrollTop;
    return snapshot;
  }

  private getTopMessageId(container: HTMLElement): string | null {
    return container.querySelector<HTMLElement>('[data-message-id]')?.dataset.messageId ?? null;
  }

  private waitForHistoryLoad(container: HTMLElement, prevHeight: number, prevTopId: string | null, timeoutMs = 260): Promise<boolean> {
    return new Promise((resolve) => {
      const start = performance.now();
      const poll = () => {
        const changed = container.scrollHeight > prevHeight + 8 || this.getTopMessageId(container) !== prevTopId;
        if (changed) {
          window.setTimeout(() => resolve(true), 30);
          return;
        }
        if (performance.now() - start >= timeoutMs) {
          resolve(false);
          return;
        }
        window.setTimeout(poll, 45);
      };
      requestAnimationFrame(poll);
    });
  }

  private waitForVirtualTick(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => window.setTimeout(resolve, 16));
    });
  }

  private async indexEntireConversation(container: HTMLElement): Promise<void> {
    if (this.isIndexing) return;
    this.isIndexing = true;
    const originalScrollTop = container.scrollTop;
    const initialScrollHeight = container.scrollHeight;
    const startConversationId = this.conversationId;
    const deadline = performance.now() + 2600;
    let cancelled = false;

    const snapshot = this.mountFreezeSnapshot(container, originalScrollTop);
    const removeSnapshot = () => { snapshot?.remove(); };
    const cancel = () => {
      cancelled = true;
      removeSnapshot();
    };
    window.addEventListener('wheel', cancel, { passive: true, once: true });
    window.addEventListener('pointerdown', cancel, { passive: true, once: true });
    window.addEventListener('touchstart', cancel, { passive: true, once: true });

    const setSpinning = (spinning: boolean) => {
      this.locatorBar?.querySelector<HTMLElement>('.dbx-locator-refresh')?.classList.toggle('is-spinning', spinning);
      this.popoverEl?.querySelector<HTMLElement>('.dbx-locator-refresh')?.classList.toggle('is-spinning', spinning);
    };
    setSpinning(true);

    try {
      this.messageCache.clear();

      // Phase 1: Pull earlier paginated history quietly behind the freeze snapshot.
      let stableTopRounds = 0;
      for (let round = 0; round < 15 && !cancelled && performance.now() < deadline && this.conversationId === startConversationId; round++) {
        const prevHeight = container.scrollHeight;
        const prevTopId = this.getTopMessageId(container);
        container.scrollTo({ top: 0, behavior: 'auto' });
        const loadedMore = await this.waitForHistoryLoad(container, prevHeight, prevTopId, 240);
        if (cancelled || this.conversationId !== startConversationId) break;
        this.collectVisibleMessages(container);
        if (loadedMore) {
          stableTopRounds = 0;
        } else {
          stableTopRounds++;
          if (stableTopRounds >= 2) break;
        }
      }

      // Phase 2: Fast top-to-bottom sweep with large steps (~16ms/step) behind the freeze snapshot.
      let target = 0;
      let iterations = 0;
      let lastMax = -1;

      while (iterations < 160 && !cancelled && performance.now() < deadline && this.conversationId === startConversationId) {
        container.scrollTo({ top: target, behavior: 'auto' });
        await this.waitForVirtualTick();
        if (cancelled || this.conversationId !== startConversationId) break;
        this.collectVisibleMessages(container);

        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
        if (target >= maxScroll && maxScroll === lastMax) break;
        lastMax = maxScroll;
        const step = Math.max(480, container.clientHeight * 0.92);
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
      setSpinning(false);
      if (!cancelled && this.conversationId === startConversationId) {
        const heightDelta = Math.max(0, container.scrollHeight - initialScrollHeight);
        container.scrollTo({ top: originalScrollTop + heightDelta, behavior: 'auto' });
        await this.waitForVirtualTick();
      }
      removeSnapshot();
      if (this.conversationId === startConversationId) {
        this.collectVisibleMessages(container);
        this.rebuildMarkers();
        this.updateLocatorDots();
        this.syncActiveMarkerFromScroll(container);
        if (this.popoverEl?.classList.contains('is-open')) {
          this.renderPopoverList();
        }
      }
      this.isIndexing = false;
    }
  }

  private waitForVirtualList(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(resolve, 35)));
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

    if (text.length > 68) {
      return text.substring(0, 68) + '…';
    }
    return text;
  }

  private createLocatorBar(): void {
    if (this.locatorBar) return;

    const bar = document.createElement('div');
    bar.id = 'dbx-quick-locator';
    bar.innerHTML = `<div class="dbx-locator-track"></div>`;

    bar.addEventListener('mouseenter', () => {
      this.openPopover();
    });
    bar.addEventListener('mouseleave', (e) => {
      const related = e.relatedTarget as Node | null;
      if (!this.popoverEl || !related || !this.popoverEl.contains(related)) {
        this.scheduleHidePopover();
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
      dot.type = 'button';
      dot.className = 'dbx-locator-dot' +
        (marker.starred ? ' starred' : '') +
        (index === this.activeMarkerIndex ? ' active' : '');
      dot.setAttribute('data-marker-index', String(index));
      dot.setAttribute('data-marker-text', marker.text);
      dot.setAttribute('aria-label', `跳转到第 ${index + 1} 条消息：${marker.text}`);

      dot.addEventListener('mouseenter', () => {
        this.hoveredIndex = index;
        this.openPopover(index);
      });

      dot.addEventListener('click', () => {
        void this.scrollToMessage(marker);
      });

      track.appendChild(dot);
    });
    track.scrollTop = previousScrollTop;

    if (this.popoverEl?.classList.contains('is-open')) {
      this.renderPopoverList();
    }
  }

  private ensurePopover(): HTMLElement {
    if (this.popoverEl) return this.popoverEl;

    const popover = document.createElement('aside');
    popover.id = 'dbx-locator-popover';
    popover.setAttribute('aria-label', '对话快速定位目录');
    popover.innerHTML = `
      <header class="dbx-locator-popover-header">
        <div class="dbx-locator-popover-title-group">
          <span class="dbx-locator-popover-title">对话目录</span>
          <span class="dbx-locator-popover-count">0</span>
        </div>
        <div class="dbx-locator-popover-actions">
          <button type="button" class="dbx-locator-filter-star" title="仅显示已收藏" aria-label="仅显示已收藏" aria-pressed="false">
            ${STAR_SVG(false)}
          </button>
          <button type="button" class="dbx-locator-refresh" title="静默加载全部历史定位点" aria-label="静默加载全部历史定位点">
            ${REFRESH_SVG}
          </button>
        </div>
      </header>
      <div class="dbx-locator-list"></div>
    `;

    popover.addEventListener('mouseenter', () => {
      if (this.hidePopoverTimer !== null) {
        clearTimeout(this.hidePopoverTimer);
        this.hidePopoverTimer = null;
      }
    });

    popover.addEventListener('mouseleave', (e) => {
      const related = e.relatedTarget as Node | null;
      if (!this.locatorBar || !related || !this.locatorBar.contains(related)) {
        this.scheduleHidePopover();
      }
    });

    popover.querySelector('.dbx-locator-filter-star')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.filterStarredOnly = !this.filterStarredOnly;
      this.renderPopoverList();
    });

    popover.querySelector('.dbx-locator-refresh')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = this.scrollContainer;
      if (container) {
        void this.indexEntireConversation(container);
      }
    });

    document.body.appendChild(popover);
    this.popoverEl = popover;
    return popover;
  }

  private openPopover(focusIndex?: number): void {
    if (this.hidePopoverTimer !== null) {
      clearTimeout(this.hidePopoverTimer);
      this.hidePopoverTimer = null;
    }

    const popover = this.ensurePopover();
    this.renderPopoverList();

    if (this.locatorBar) {
      const barRect = this.locatorBar.getBoundingClientRect();
      const rightOffset = Math.max(16, window.innerWidth - barRect.left + 10);
      popover.style.right = `${rightOffset}px`;
    }

    popover.classList.add('is-open');

    const targetIdx = focusIndex ?? this.activeMarkerIndex;
    if (targetIdx >= 0) {
      const row = popover.querySelector<HTMLElement>(`.dbx-locator-item[data-marker-index="${targetIdx}"]`);
      row?.scrollIntoView({ block: 'nearest' });
    }
  }

  private scheduleHidePopover(): void {
    if (this.hidePopoverTimer !== null) {
      clearTimeout(this.hidePopoverTimer);
    }
    this.hidePopoverTimer = window.setTimeout(() => {
      this.hidePopoverImmediate();
    }, 180);
  }

  private hidePopoverImmediate(): void {
    if (this.hidePopoverTimer !== null) {
      clearTimeout(this.hidePopoverTimer);
      this.hidePopoverTimer = null;
    }
    this.hoveredIndex = -1;
    this.popoverEl?.classList.remove('is-open');
  }

  private renderPopoverList(): void {
    if (!this.popoverEl) return;

    const countEl = this.popoverEl.querySelector('.dbx-locator-popover-count');
    if (countEl) {
      countEl.textContent = String(this.markers.length);
    }

    const filterBtn = this.popoverEl.querySelector<HTMLButtonElement>('.dbx-locator-filter-star');
    if (filterBtn) {
      filterBtn.classList.toggle('is-active', this.filterStarredOnly);
      filterBtn.setAttribute('aria-pressed', String(this.filterStarredOnly));
      filterBtn.innerHTML = STAR_SVG(this.filterStarredOnly);
    }

    const list = this.popoverEl.querySelector('.dbx-locator-list');
    if (!list) return;
    list.replaceChildren();

    const visibleMarkers = this.filterStarredOnly
      ? this.markers.filter((m) => m.starred)
      : this.markers;

    if (visibleMarkers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dbx-locator-empty';
      empty.textContent = this.filterStarredOnly ? '暂无已收藏的消息' : '暂无可定位的用户消息';
      list.appendChild(empty);
      return;
    }

    for (const marker of visibleMarkers) {
      const row = document.createElement('div');
      row.className = 'dbx-locator-item' +
        (marker.index === this.activeMarkerIndex ? ' is-active' : '') +
        (marker.index === this.hoveredIndex ? ' is-hovered' : '');
      row.dataset.markerIndex = String(marker.index);

      const mainBtn = document.createElement('button');
      mainBtn.type = 'button';
      mainBtn.className = 'dbx-locator-item-main';

      const idxBadge = document.createElement('span');
      idxBadge.className = 'dbx-locator-item-index';
      idxBadge.textContent = String(marker.index + 1).padStart(2, '0');

      const textSpan = document.createElement('span');
      textSpan.className = 'dbx-locator-item-text';
      textSpan.textContent = marker.text;

      mainBtn.append(idxBadge, textSpan);
      mainBtn.addEventListener('click', () => {
        void this.scrollToMessage(marker);
      });

      const starBtn = document.createElement('button');
      starBtn.type = 'button';
      starBtn.className = `dbx-locator-item-star${marker.starred ? ' is-starred' : ''}`;
      starBtn.title = marker.starred ? '取消收藏' : '收藏消息';
      starBtn.setAttribute('aria-label', starBtn.title);
      starBtn.setAttribute('aria-pressed', String(marker.starred));
      starBtn.innerHTML = STAR_SVG(marker.starred);

      starBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.toggleMarkerStar(marker);
      });

      row.append(mainBtn, starBtn);
      list.appendChild(row);
    }
  }

  private async toggleMarkerStar(marker: MessageMarker): Promise<void> {
    const isNowStarred = !marker.starred;
    marker.starred = isNowStarred;

    if (isNowStarred) {
      this.starredMarkers.add(marker.index);
    } else {
      this.starredMarkers.delete(marker.index);
    }

    const dot = this.locatorBar?.querySelector<HTMLElement>(`.dbx-locator-dot[data-marker-index="${marker.index}"]`);
    dot?.classList.toggle('starred', isNowStarred);

    this.renderPopoverList();

    if (this.conversationId && this.conversationId !== 'unknown') {
      try {
        if (isNowStarred) {
          await storageService.addStarredMessage(this.conversationId, marker.index, {
            messageId: marker.messageId,
            text: marker.text,
          });
        } else {
          await storageService.removeStarredMessage(this.conversationId, marker.index);
        }
      } catch {
        // Ignore storage write error
      }
    }
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

    const settledTop = this.getCenteredScrollTop(container, element);
    if (Math.abs(container.scrollTop - settledTop) > 28) {
      await this.smoothScrollContainerTo(container, settledTop);
    }

    element.classList.add('dbx-message-highlight');
    window.setTimeout(() => {
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

    if (this.popoverEl?.classList.contains('is-open')) {
      this.popoverEl.querySelectorAll<HTMLElement>('.dbx-locator-item').forEach((row) => {
        row.classList.toggle('is-active', row.dataset.markerIndex === String(index));
      });
    }
  }

  private findMessageElement(messageId: string): HTMLElement | null {
    const node = Array.from(document.querySelectorAll<HTMLElement>('[data-message-id]'))
      .find((el) => el.dataset.messageId === messageId && !el.closest('[data-dbx-freeze-snapshot="true"]'));
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
    this.hidePopoverImmediate();
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.unsubscribeUrl?.();
    this.unsubscribeUrl = null;
    if (this.popoverEl) {
      this.popoverEl.remove();
      this.popoverEl = null;
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
