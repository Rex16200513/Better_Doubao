import { storageService } from '../../core/services/StorageService';
import { pageLifecycle } from '../../core/services/PageLifecycle';
import { getConversationId } from '../../core/utils/dom';
import { showToast } from '../../core/utils/ui';

const TIMESTAMP_PATTERN = /(\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:今天|昨天)\s*\d{1,2}:\d{2})/;

export function hasNativeLocatorTimestamp(text: string): boolean {
  return TIMESTAMP_PATTERN.test(text);
}

function collectButtonMeta(el: HTMLElement | null): string {
  if (!el) return '';
  return [
    el.getAttribute('aria-label') || '',
    el.getAttribute('title') || '',
    el.getAttribute('data-testid') || '',
    el.getAttribute('data-action') || '',
    el.className?.toString() || '',
    el.textContent?.trim() || '',
  ].join(' ').toLowerCase();
}

function hasDislikeSignal(meta: string): boolean {
  return (
    meta.includes('dislike') ||
    meta.includes('unlike') ||
    meta.includes('thumb_down') ||
    meta.includes('thumb-down') ||
    meta.includes('thumbs-down') ||
    meta.includes('thumbs_down') ||
    meta.includes('踩') ||
    meta.includes('bad')
  );
}

function hasOtherActionSignal(meta: string): boolean {
  return (
    meta.includes('copy') ||
    meta.includes('复制') ||
    meta.includes('share') ||
    meta.includes('分享') ||
    meta.includes('audio') ||
    meta.includes('voice') ||
    meta.includes('tts') ||
    meta.includes('朗读') ||
    meta.includes('播放') ||
    meta.includes('regenerate') ||
    meta.includes('retry') ||
    meta.includes('重新生成') ||
    meta.includes('more') ||
    meta.includes('更多')
  );
}

function hasLikeSignal(meta: string): boolean {
  return (
    meta.includes('like') ||
    meta.includes('praise') ||
    meta.includes('thumb_up') ||
    meta.includes('thumb-up') ||
    meta.includes('thumbs-up') ||
    meta.includes('thumbs_up') ||
    meta.includes('thumb') ||
    meta.includes('赞') ||
    meta.includes('good')
  );
}

/**
 * Walk up from a clicked action button to find the horizontal message action bar
 * even when icons are wrapped in tooltip containers or [like, dislike] sub-groups.
 */
function findActionBarAndSlotIndex(btn: HTMLElement): { slots: HTMLElement[]; index: number } | null {
  let bar: HTMLElement | null = btn.parentElement;

  for (let depth = 0; depth < 4 && bar; depth++) {
    // 1. Prefer real button/[role="button"] descendants inside the action bar (handles tooltip wrappers & sub-groups).
    if (typeof bar.querySelectorAll === 'function') {
      const iconBtns = Array.from(bar.querySelectorAll<HTMLElement>('button, [role="button"]'))
        .filter(el => !!el.querySelector('svg') && !(el.textContent?.trim()));
      if (iconBtns.length >= 4 && iconBtns.length <= 10) {
        const idx = iconBtns.indexOf(btn);
        if (idx >= 0) {
          return { slots: iconBtns, index: idx };
        }
      }
    }

    // 2. Fallback for non-<button> icon wrappers: only count single-icon direct children.
    const rawChildren = Array.from(bar.children || []) as HTMLElement[];
    const iconSlots = rawChildren.filter((child) => {
      const svgs = typeof child.querySelectorAll === 'function'
        ? child.querySelectorAll('svg').length
        : (child.querySelector('svg') ? 1 : 0);
      if (svgs !== 1) return false;
      const text = (child.textContent || '').trim();
      return text.length === 0;
    });

    if (iconSlots.length >= 4 && iconSlots.length <= 10) {
      const idx = iconSlots.findIndex(s => s === btn || (typeof s.contains === 'function' && s.contains(btn)));
      if (idx >= 0) {
        return { slots: iconSlots, index: idx };
      }
    }

    bar = bar.parentElement;
  }

  return null;
}

/**
 * Detect whether a clicked button inside a chat message action bar is Doubao's native
 * thumbs-up ("赞") button without matching "踩" / dislike or other action controls.
 */
export function isNativeLikeButton(btn: HTMLElement): boolean {
  const selfMeta = collectButtonMeta(btn);
  const parentMeta = btn.parentElement && btn.parentElement.childElementCount <= 2
    ? collectButtonMeta(btn.parentElement)
    : '';
  const combined = `${selfMeta} ${parentMeta}`.trim();

  if (hasDislikeSignal(combined) || hasOtherActionSignal(combined)) {
    return false;
  }
  if (hasLikeSignal(combined)) {
    return true;
  }

  // Structural fallback: in Doubao's assistant action bar
  // [copy, read/audio, like, dislike, share, regenerate, more],
  // each icon is often wrapped in its own tooltip container.
  const barInfo = findActionBarAndSlotIndex(btn);
  if (!barInfo) return false;

  const { slots, index } = barInfo;
  // If the next slot explicitly identifies as dislike/踩, current slot is like/赞.
  const nextSlot = slots[index + 1];
  if (nextSlot && hasDislikeSignal(collectButtonMeta(nextSlot) + ' ' + collectButtonMeta(nextSlot.querySelector('button, [role="button"]')))) {
    return true;
  }

  // Standard 5+ icon bar layout: [0: copy, 1: audio, 2: like, 3: dislike, 4: share, ...]
  if (index === 2 && slots.length >= 5) {
    const hasSvg = !!btn.querySelector('svg');
    const textEmpty = !(btn.textContent?.trim());
    return hasSvg && textEmpty;
  }

  return false;
}

function parseRgbDarkness(color: string): number {
  const match = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (!match) return -1;
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  const a = match[4] !== undefined ? Number(match[4]) : 1;
  if (a < 0.05) return -1;
  return ((255 - r) + (255 - g) + (255 - b)) * a;
}

export class NativeLocatorEnhancer {
  private unsubscribeDom: (() => void) | null = null;
  private unsubscribeUrl: (() => void) | null = null;
  private clickHandler: ((event: MouseEvent) => void) | null = null;
  private conversationId = 'unknown';
  private starredSet = new Set<number>();

  init(): void {
    if (this.clickHandler) return;
    this.conversationId = getConversationId();
    void this.loadStarred().then(() => this.syncNativeTickHighlights());

    this.unsubscribeUrl = pageLifecycle.onUrlChange(() => {
      const nextId = getConversationId();
      if (nextId !== this.conversationId) {
        this.conversationId = nextId;
        void this.loadStarred().then(() => this.syncNativeTickHighlights());
      }
    });

    this.unsubscribeDom = pageLifecycle.onDomChange(() => {
      this.syncNativeTickHighlights();
    }, 180);

    this.clickHandler = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest('#flow_chat_sidebar, [id^="dbx-"], .dbx-unified-panel')) return;

      const btn = this.resolveClickedActionControl(target);
      if (!btn) return;
      if (!isNativeLikeButton(btn)) return;

      const msgEl = this.resolveContainingMessage(btn);
      if (!msgEl) return;

      void this.handleNativeLikeClick(msgEl);
    };
    document.addEventListener('click', this.clickHandler, true);
  }

  destroy(): void {
    this.unsubscribeDom?.();
    this.unsubscribeDom = null;
    this.unsubscribeUrl?.();
    this.unsubscribeUrl = null;
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
    document.querySelectorAll('.dbx-native-tick-liked').forEach(el => {
      el.classList.remove('dbx-native-tick-liked');
    });
  }

  private resolveClickedActionControl(target: Element): HTMLElement | null {
    const directBtn = target.closest<HTMLElement>('button, [role="button"]');
    if (directBtn) return directBtn;

    // Some Doubao action icons are plain <div>/<span> wrappers around an <svg> without role="button".
    const svg = target.closest('svg');
    if (!svg) return null;
    let cur: HTMLElement | null = svg.parentElement;
    for (let depth = 0; depth < 3 && cur && cur !== document.body; depth++) {
      const rect = cur.getBoundingClientRect();
      if (rect.width >= 16 && rect.width <= 48 && rect.height >= 16 && rect.height <= 48) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  private resolveContainingMessage(btn: HTMLElement): HTMLElement | null {
    const direct = btn.closest<HTMLElement>('[data-message-id]');
    if (direct) return direct;

    let cur: HTMLElement | null = btn.parentElement;
    for (let depth = 0; depth < 8 && cur && cur !== document.body; depth++) {
      const messages = cur.querySelectorAll<HTMLElement>('[data-message-id]');
      if (messages.length === 1) return messages[0];
      if (messages.length > 1) return messages[messages.length - 1];
      cur = cur.parentElement;
    }
    return null;
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

  private getTopLevelMessages(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-message-id]'))
      .filter(el => !el.parentElement?.closest('[data-message-id]'));
  }

  private isUserMessage(el: HTMLElement): boolean {
    const html = el.innerHTML?.toLowerCase() || '';
    return html.includes('send_message') ||
      !!el.querySelector('[class*="send-msg"], [class*="send_message"], [class*="user-bubble"], [class*="bubble-bg"]');
  }

  private getDomTurns(): Array<{ userEl: HTMLElement | null; members: HTMLElement[] }> {
    const all = this.getTopLevelMessages();
    const turns: Array<{ userEl: HTMLElement | null; members: HTMLElement[] }> = [];
    let current: { userEl: HTMLElement | null; members: HTMLElement[] } | null = null;
    let prevWasUser = false;

    for (const el of all) {
      const isUser = this.isUserMessage(el);
      if (isUser) {
        if (!prevWasUser || !current) {
          current = { userEl: el, members: [el] };
          turns.push(current);
        } else {
          current.members.push(el);
        }
        prevWasUser = true;
      } else {
        if (!current) {
          current = { userEl: null, members: [el] };
          turns.push(current);
        } else {
          current.members.push(el);
        }
        prevWasUser = false;
      }
    }
    return turns;
  }

  private getVisualTickElement(tick: HTMLElement): HTMLElement {
    const style = window.getComputedStyle(tick);
    if (parseRgbDarkness(style.backgroundColor) >= 0) return tick;
    const inner = tick.querySelector<HTMLElement>('div, span');
    return inner || tick;
  }

  private getActiveTickIndex(ticks: HTMLElement[]): number {
    let bestIdx = -1;
    let bestScore = -1;
    let minScore = Infinity;

    ticks.forEach((tick, idx) => {
      const visual = this.getVisualTickElement(tick);
      const style = window.getComputedStyle(visual);
      const darkness = Math.max(0, parseRgbDarkness(style.backgroundColor));
      const width = visual.getBoundingClientRect().width;
      // Active tick in Doubao is significantly darker (black vs light grey) and often slightly wider.
      const score = darkness + width * 4;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
      if (score < minScore) {
        minScore = score;
      }
    });

    // Ensure there is a meaningful visual distinction between the active tick and inactive ticks.
    if (bestIdx >= 0 && bestScore - minScore >= 40) {
      return bestIdx;
    }
    return -1;
  }

  private getViewportActiveDomTurnIndex(turns: Array<{ userEl: HTMLElement | null; members: HTMLElement[] }>): number {
    const targetY = window.innerHeight * 0.38;
    let bestIdx = 0;
    let bestDist = Infinity;

    turns.forEach((turn, idx) => {
      const anchor = turn.members[turn.members.length - 1] || turn.userEl;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const dist = rect.top <= targetY && rect.bottom >= targetY
        ? 0
        : Math.min(Math.abs(rect.top - targetY), Math.abs(rect.bottom - targetY));
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }

  private resolveTurnInfo(clickedMsg: HTMLElement): { turnIndex: number; messageId?: string; excerpt: string } | null {
    const turns = this.getDomTurns();
    const clickedDomTurnIdx = turns.findIndex(t => t.members.some(m => m === clickedMsg || m.contains(clickedMsg)));
    if (clickedDomTurnIdx < 0) return null;

    const turn = turns[clickedDomTurnIdx];
    const ticks = this.findNativeTickItems();
    let tickIndex = clickedDomTurnIdx;

    if (ticks.length > 0 && ticks.length !== turns.length) {
      // Align DOM turn index to Doubao's full-history native tick rail using the active tick anchor.
      const activeTickIdx = this.getActiveTickIndex(ticks);
      if (activeTickIdx >= 0) {
        const activeDomTurnIdx = this.getViewportActiveDomTurnIndex(turns);
        tickIndex = Math.max(0, Math.min(ticks.length - 1, activeTickIdx + (clickedDomTurnIdx - activeDomTurnIdx)));
      } else {
        tickIndex = Math.max(0, Math.min(ticks.length - 1, ticks.length - turns.length + clickedDomTurnIdx));
      }
    }

    const rawText = (turn.userEl?.textContent || clickedMsg.textContent || '').replace(/\s+/g, ' ').trim();
    const excerpt = rawText.length > 60 ? `${rawText.slice(0, 60)}…` : (rawText || `第 ${tickIndex + 1} 轮对话`);
    return {
      turnIndex: tickIndex,
      messageId: turn.userEl?.dataset.messageId || clickedMsg.dataset.messageId,
      excerpt,
    };
  }

  private async handleNativeLikeClick(msgEl: HTMLElement): Promise<void> {
    this.conversationId = getConversationId();
    if (!this.conversationId || this.conversationId === 'unknown') return;

    const info = this.resolveTurnInfo(msgEl);
    if (!info) return;

    const nextStarred = !this.starredSet.has(info.turnIndex);
    if (nextStarred) {
      this.starredSet.add(info.turnIndex);
      await storageService.addStarredMessage(this.conversationId, info.turnIndex, {
        messageId: info.messageId,
        text: info.excerpt,
      });
      showToast('已同步标记到原生定位点与收藏目录', 'success');
    } else {
      this.starredSet.delete(info.turnIndex);
      await storageService.removeStarredMessage(this.conversationId, info.turnIndex);
      showToast('已取消该条定位点标记', 'info');
    }

    this.syncNativeTickHighlights();
    window.setTimeout(() => this.syncNativeTickHighlights(), 160);
  }

  /**
   * Find Doubao's native quick-locator tick rail (a narrow vertical stack of slender
   * horizontal tick bars outside the sidebar and message bubbles).
   */
  findNativeTickItems(): HTMLElement[] {
    const sidebarRight = document.querySelector<HTMLElement>('#flow_chat_sidebar')?.getBoundingClientRect().right ?? 0;
    const candidates = document.querySelectorAll<HTMLElement>('div, ul, nav');
    let best: HTMLElement[] = [];

    for (const container of candidates) {
      if (container.closest('#flow_chat_sidebar, [data-message-id], #input-engine-container, [id^="dbx-"], .dbx-unified-panel')) {
        continue;
      }
      const childCount = container.childElementCount;
      if (childCount < 2 || childCount > 200) continue;

      const rect = container.getBoundingClientRect();
      if (rect.width < 6 || rect.width > 56 || rect.height < 16) continue;
      // Native tick rail sits near the left edge of the chat area (right of sidebar, left half of screen).
      if (rect.left < Math.max(0, sidebarRight - 8) || rect.left > window.innerWidth * 0.55) continue;

      const children = Array.from(container.children) as HTMLElement[];
      const allLookLikeTicks = children.every((child) => {
        if ((child.textContent || '').trim().length > 0) return false;
        const r = child.getBoundingClientRect();
        return r.width >= 4 && r.width <= 40 && r.height >= 1 && r.height <= 22;
      });
      if (allLookLikeTicks && children.length >= best.length) {
        best = children;
      }
    }
    return best;
  }

  syncNativeTickHighlights(): void {
    const ticks = this.findNativeTickItems();
    if (!ticks.length) return;

    ticks.forEach((tick, index) => {
      const liked = this.starredSet.has(index);
      const visual = this.getVisualTickElement(tick);
      if (visual !== tick) {
        tick.classList.remove('dbx-native-tick-liked');
      }
      visual.classList.toggle('dbx-native-tick-liked', liked);
    });
  }
}

export const nativeLocatorEnhancer = new NativeLocatorEnhancer();
