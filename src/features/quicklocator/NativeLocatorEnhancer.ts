import { storageService } from '../../core/services/StorageService';
import { pageLifecycle } from '../../core/services/PageLifecycle';
import { getConversationId } from '../../core/utils/dom';
import { showToast } from '../../core/utils/ui';

const TIMESTAMP_PATTERN = /(\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:今天|昨天)\s*\d{1,2}:\d{2})/;

export function hasNativeLocatorTimestamp(text: string): boolean {
  return TIMESTAMP_PATTERN.test(text);
}

/**
 * Detect whether a clicked button inside a chat message action bar is Doubao's native
 * thumbs-up ("赞") button without matching "踩" / dislike or other action controls.
 */
export function isNativeLikeButton(btn: HTMLElement): boolean {
  const attrs = [
    btn.getAttribute('aria-label') || '',
    btn.getAttribute('title') || '',
    btn.getAttribute('data-testid') || '',
    btn.className?.toString() || '',
    btn.textContent?.trim() || '',
  ].join(' ').toLowerCase();

  if (attrs.includes('dislike') || attrs.includes('unlike') || attrs.includes('踩') || attrs.includes('down')) {
    return false;
  }
  if (
    attrs.includes('like') ||
    attrs.includes('praise') ||
    attrs.includes('thumb') ||
    attrs.includes('赞') ||
    attrs.includes('good')
  ) {
    return true;
  }

  // Structural fallback: in Doubao's assistant action bar [copy, read/audio, like, dislike, share, ...],
  // the like button is an icon-only button located immediately before the dislike button in the action bar.
  const bar = btn.parentElement;
  if (!bar || bar.childElementCount < 4) return false;
  const buttons = Array.from(bar.querySelectorAll<HTMLElement>('button, [role="button"]'));
  const idx = buttons.indexOf(btn);
  if (idx === 2 && buttons.length >= 5) {
    const hasSvg = !!btn.querySelector('svg');
    const textEmpty = !(btn.textContent?.trim());
    return hasSvg && textEmpty;
  }
  return false;
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
      const btn = target?.closest<HTMLElement>('button, [role="button"]');
      if (!btn || btn.closest('#flow_chat_sidebar, [id^="dbx-"], .dbx-unified-panel')) return;
      const msgEl = btn.closest<HTMLElement>('[data-message-id]');
      if (!msgEl) return;
      if (!isNativeLikeButton(btn)) return;

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

  private resolveTurnInfo(clickedMsg: HTMLElement): { turnIndex: number; messageId?: string; excerpt: string } | null {
    const all = this.getTopLevelMessages();
    const pos = all.indexOf(clickedMsg);
    if (pos < 0) return null;

    // Count how many user turns occurred up to and including this reply.
    let turnIndex = -1;
    let lastUserEl: HTMLElement | null = null;
    let prevWasUser = false;
    for (let i = 0; i <= pos; i++) {
      const isUser = this.isUserMessage(all[i]);
      if (isUser) {
        if (!prevWasUser) {
          turnIndex++;
          lastUserEl = all[i];
        }
        prevWasUser = true;
      } else {
        prevWasUser = false;
      }
    }

    if (turnIndex < 0) turnIndex = 0;
    const rawText = (lastUserEl?.textContent || clickedMsg.textContent || '').replace(/\s+/g, ' ').trim();
    const excerpt = rawText.length > 60 ? `${rawText.slice(0, 60)}…` : (rawText || `第 ${turnIndex + 1} 轮对话`);
    return {
      turnIndex,
      messageId: lastUserEl?.dataset.messageId || clickedMsg.dataset.messageId,
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
  }

  /**
   * Find Doubao's native quick-locator tick rail (a narrow vertical stack of slender
   * horizontal tick bars outside the sidebar and message bubbles) and highlight liked turns.
   */
  findNativeTickItems(): HTMLElement[] {
    const candidates = document.querySelectorAll<HTMLElement>('div, ul, nav');
    for (const container of candidates) {
      if (container.closest('#flow_chat_sidebar, [data-message-id], #input-engine-container, [id^="dbx-"], .dbx-unified-panel')) {
        continue;
      }
      const childCount = container.childElementCount;
      if (childCount < 2 || childCount > 150) continue;

      const rect = container.getBoundingClientRect();
      if (rect.width < 6 || rect.width > 48 || rect.height < 16) continue;

      const children = Array.from(container.children) as HTMLElement[];
      const allLookLikeTicks = children.every((child) => {
        if ((child.textContent || '').trim().length > 0) return false;
        const r = child.getBoundingClientRect();
        return r.width >= 4 && r.width <= 36 && r.height >= 1 && r.height <= 12;
      });
      if (allLookLikeTicks) {
        return children;
      }
    }
    return [];
  }

  syncNativeTickHighlights(): void {
    const ticks = this.findNativeTickItems();
    if (!ticks.length) return;

    ticks.forEach((tick, index) => {
      tick.classList.toggle('dbx-native-tick-liked', this.starredSet.has(index));
    });
  }
}

export const nativeLocatorEnhancer = new NativeLocatorEnhancer();
