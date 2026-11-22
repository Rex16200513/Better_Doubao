import { storageService } from '../../core/services/StorageService';
import { pageLifecycle } from '../../core/services/PageLifecycle';
import { getConversationId } from '../../core/utils/dom';

const TIMESTAMP_PATTERN = /(\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:今天|昨天)\s*\d{1,2}:\d{2})/;

const STAR_SVG = (filled: boolean) => `
  <svg width="13" height="13" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
`;

export function hasNativeLocatorTimestamp(text: string): boolean {
  return TIMESTAMP_PATTERN.test(text);
}

export class NativeLocatorEnhancer {
  private unsubscribeDom: (() => void) | null = null;
  private unsubscribeUrl: (() => void) | null = null;
  private pointerOverHandler: (() => void) | null = null;
  private pointerScanTimer: number | null = null;
  private conversationId = 'unknown';
  private starredSet = new Set<number>();
  private filterQuery = '';
  private starredOnly = false;

  init(): void {
    if (this.unsubscribeDom) return;
    this.conversationId = getConversationId();
    void this.loadStarred();

    this.unsubscribeUrl = pageLifecycle.onUrlChange(() => {
      const nextId = getConversationId();
      if (nextId !== this.conversationId) {
        this.conversationId = nextId;
        this.filterQuery = '';
        this.starredOnly = false;
        void this.loadStarred().then(() => this.scanAndEnhance());
      }
    });

    this.unsubscribeDom = pageLifecycle.onDomChange(() => {
      this.scanAndEnhance();
    }, 100);

    // Doubao's native quick-locator cards may toggle via CSS hover/opacity without childList mutations.
    this.pointerOverHandler = () => {
      if (this.pointerScanTimer !== null) return;
      this.pointerScanTimer = window.setTimeout(() => {
        this.pointerScanTimer = null;
        this.scanAndEnhance();
      }, 90);
    };
    document.addEventListener('pointerover', this.pointerOverHandler, { passive: true });

    this.scanAndEnhance();
  }

  destroy(): void {
    this.unsubscribeDom?.();
    this.unsubscribeDom = null;
    this.unsubscribeUrl?.();
    this.unsubscribeUrl = null;
    if (this.pointerOverHandler) {
      document.removeEventListener('pointerover', this.pointerOverHandler);
      this.pointerOverHandler = null;
    }
    if (this.pointerScanTimer !== null) {
      clearTimeout(this.pointerScanTimer);
      this.pointerScanTimer = null;
    }
    document.querySelectorAll('.dbx-native-locator-toolbar, .dbx-native-card-star').forEach(el => el.remove());
    document.querySelectorAll<HTMLElement>('[data-dbx-native-card]').forEach(el => {
      el.classList.remove('dbx-native-card-starred', 'dbx-native-card-filtered');
      delete el.dataset.dbxNativeCard;
    });
  }

  private async loadStarred(): Promise<void> {
    if (!this.conversationId || this.conversationId === 'unknown') {
      this.starredSet = new Set();
      return;
    }
    try {
      const starred = await storageService.getStarredMessages(this.conversationId);
      this.starredSet = new Set(starred);
    } catch {
      this.starredSet = new Set();
    }
  }

  private isInsideIgnoredArea(el: Element): boolean {
    return !!el.closest(
      '#flow_chat_sidebar, [data-message-id], #input-engine-container, [id^="dbx-"], .dbx-unified-panel, .dbx-popup'
    );
  }

  private extractCardTitle(card: HTMLElement): string {
    const clone = card.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.dbx-native-card-star, button, svg').forEach(n => n.remove());
    const lines = (clone.innerText || clone.textContent || '')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s && !hasNativeLocatorTimestamp(s));
    const title = lines[0] || '';
    return title.length > 68 ? `${title.slice(0, 68)}…` : title;
  }

  /**
   * Locate Doubao's native quick-locator cards by starting from timestamp leaf elements
   * (e.g. "3月12日 17:19") and walking upward to the individual rounded card element.
   */
  private findNativeLocatorGroups(): Array<{ container: HTMLElement; cards: HTMLElement[] }> {
    const groups = new Map<HTMLElement, HTMLElement[]>();
    const seenCards = new Set<HTMLElement>();

    const leaves = document.querySelectorAll<HTMLElement>('div, span, time, p');
    leaves.forEach((leaf) => {
      if (leaf.childElementCount > 0) return;
      if (this.isInsideIgnoredArea(leaf)) return;
      const leafText = leaf.textContent?.trim() || '';
      if (leafText.length < 5 || leafText.length > 26 || !hasNativeLocatorTimestamp(leafText)) return;

      const leafRect = leaf.getBoundingClientRect();
      if (leafRect.width === 0 || leafRect.height === 0) return;

      // Walk up to find the card element that holds the prompt title + snippet + timestamp.
      let card: HTMLElement | null = leaf.parentElement;
      for (let depth = 0; depth < 6 && card && card !== document.body; depth++) {
        if (this.isInsideIgnoredArea(card)) {
          card = null;
          break;
        }
        const rect = card.getBoundingClientRect();
        const text = card.textContent?.trim() || '';
        const style = getComputedStyle(card);
        const radius = Number.parseFloat(style.borderRadius || '0');
        const hasCardLook = radius >= 6 || style.borderWidth !== '0px' || style.cursor === 'pointer';

        if (
          rect.width >= 150 &&
          rect.width <= 640 &&
          rect.height >= 44 &&
          rect.height <= 280 &&
          text.length > leafText.length + 4 &&
          text.length <= 600 &&
          hasCardLook
        ) {
          break;
        }
        card = card.parentElement;
      }

      if (!card || card === document.body || seenCards.has(card)) return;
      const parent = card.parentElement;
      if (!parent || this.isInsideIgnoredArea(parent)) return;

      seenCards.add(card);
      const list = groups.get(parent) ?? [];
      list.push(card);
      groups.set(parent, list);
    });

    return Array.from(groups.entries()).map(([container, cards]) => ({ container, cards }));
  }

  private scanAndEnhance(): void {
    const groups = this.findNativeLocatorGroups();
    for (const { container, cards } of groups) {
      if (cards.length > 1) {
        this.ensureToolbar(container, cards);
      }
      cards.forEach((card, index) => {
        this.enhanceCard(card, index, cards);
      });
      this.applyFilter(cards);
    }
  }

  private ensureToolbar(container: HTMLElement, cards: HTMLElement[]): void {
    let toolbar = container.querySelector<HTMLElement>(':scope > .dbx-native-locator-toolbar');

    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'dbx-native-locator-toolbar';

      const input = document.createElement('input');
      input.type = 'search';
      input.className = 'dbx-native-locator-search';
      input.placeholder = '筛选定位点…';
      input.setAttribute('aria-label', '筛选定位点');
      input.value = this.filterQuery;
      input.addEventListener('click', e => e.stopPropagation());
      input.addEventListener('input', () => {
        this.filterQuery = input.value.trim().toLocaleLowerCase();
        this.applyFilter(cards);
      });

      const starFilterBtn = document.createElement('button');
      starFilterBtn.type = 'button';
      starFilterBtn.className = `dbx-native-locator-filter-star${this.starredOnly ? ' is-active' : ''}`;
      starFilterBtn.title = '仅看已收藏';
      starFilterBtn.setAttribute('aria-label', '仅看已收藏');
      starFilterBtn.setAttribute('aria-pressed', String(this.starredOnly));
      starFilterBtn.innerHTML = STAR_SVG(this.starredOnly);
      starFilterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.starredOnly = !this.starredOnly;
        starFilterBtn.classList.toggle('is-active', this.starredOnly);
        starFilterBtn.setAttribute('aria-pressed', String(this.starredOnly));
        starFilterBtn.innerHTML = STAR_SVG(this.starredOnly);
        this.applyFilter(cards);
      });

      toolbar.append(input, starFilterBtn);
      container.insertBefore(toolbar, container.firstChild);
    } else {
      const starFilterBtn = toolbar.querySelector<HTMLButtonElement>('.dbx-native-locator-filter-star');
      if (starFilterBtn) {
        starFilterBtn.classList.toggle('is-active', this.starredOnly);
        starFilterBtn.setAttribute('aria-pressed', String(this.starredOnly));
        starFilterBtn.innerHTML = STAR_SVG(this.starredOnly);
      }
    }
  }

  private enhanceCard(card: HTMLElement, index: number, allCards: HTMLElement[]): void {
    const isStarred = this.starredSet.has(index);
    card.dataset.dbxNativeCard = String(index);
    card.classList.toggle('dbx-native-card-starred', isStarred);

    if (getComputedStyle(card).position === 'static') {
      card.style.position = 'relative';
    }

    let starBtn = card.querySelector<HTMLButtonElement>(':scope > .dbx-native-card-star');
    if (!starBtn) {
      starBtn = document.createElement('button');
      starBtn.type = 'button';
      starBtn.className = 'dbx-native-card-star';
      starBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const cardIndex = Number.parseInt(card.dataset.dbxNativeCard || String(index), 10);
        void this.toggleStar(card, cardIndex, allCards);
      });
      card.appendChild(starBtn);
    }

    starBtn.classList.toggle('is-starred', isStarred);
    starBtn.title = isStarred ? '取消收藏' : '收藏此定位点';
    starBtn.setAttribute('aria-label', starBtn.title);
    starBtn.setAttribute('aria-pressed', String(isStarred));
    starBtn.innerHTML = STAR_SVG(isStarred);
  }

  private async toggleStar(card: HTMLElement, index: number, allCards: HTMLElement[]): Promise<void> {
    const nextStarred = !this.starredSet.has(index);
    if (nextStarred) {
      this.starredSet.add(index);
    } else {
      this.starredSet.delete(index);
    }

    this.enhanceCard(card, index, allCards);
    this.applyFilter(allCards);

    if (this.conversationId && this.conversationId !== 'unknown') {
      try {
        if (nextStarred) {
          const title = this.extractCardTitle(card) || `第 ${index + 1} 条定位点`;
          await storageService.addStarredMessage(this.conversationId, index, { text: title });
        } else {
          await storageService.removeStarredMessage(this.conversationId, index);
        }
      } catch {
        // Ignore storage errors
      }
    }
  }

  applyFilter(cards: HTMLElement[]): void {
    for (const card of cards) {
      const idx = Number.parseInt(card.dataset.dbxNativeCard || '-1', 10);
      const matchesStar = !this.starredOnly || this.starredSet.has(idx);
      const matchesQuery = !this.filterQuery || (card.textContent || '').toLocaleLowerCase().includes(this.filterQuery);
      card.classList.toggle('dbx-native-card-filtered', !(matchesStar && matchesQuery));
    }
  }
}

export const nativeLocatorEnhancer = new NativeLocatorEnhancer();
