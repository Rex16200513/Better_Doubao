type UrlChangeListener = (url: string) => void;
type DomChangeListener = () => void;

interface DebouncedSubscriber {
  listener: DomChangeListener;
  debounceMs: number;
  timer: number | null;
}

export class PageLifecycle {
  private urlListeners = new Set<UrlChangeListener>();
  private lastUrl = '';
  private urlPollTimer: number | null = null;
  private popstateBound = false;

  private domSubscribers = new Set<DebouncedSubscriber>();
  private domObserver: MutationObserver | null = null;

  private checkUrl = (): void => {
    const current = window.location.href;
    if (current !== this.lastUrl) {
      this.lastUrl = current;
      for (const listener of Array.from(this.urlListeners)) {
        try {
          listener(current);
        } catch (error) {
          console.error('[PageLifecycle] URL listener error:', error);
        }
      }
    }
  };

  onUrlChange(listener: UrlChangeListener): () => void {
    if (this.urlListeners.size === 0) {
      this.lastUrl = window.location.href;
      this.startUrlTracking();
    }
    this.urlListeners.add(listener);

    return () => {
      this.urlListeners.delete(listener);
      if (this.urlListeners.size === 0) {
        this.stopUrlTracking();
      }
    };
  }

  private startUrlTracking(): void {
    if (!this.popstateBound) {
      window.addEventListener('popstate', this.checkUrl);
      window.addEventListener('hashchange', this.checkUrl);
      this.popstateBound = true;
    }
    if (this.urlPollTimer === null) {
      this.urlPollTimer = window.setInterval(this.checkUrl, 1000);
    }
  }

  private stopUrlTracking(): void {
    if (this.popstateBound) {
      window.removeEventListener('popstate', this.checkUrl);
      window.removeEventListener('hashchange', this.checkUrl);
      this.popstateBound = false;
    }
    if (this.urlPollTimer !== null) {
      clearInterval(this.urlPollTimer);
      this.urlPollTimer = null;
    }
  }

  onDomChange(listener: DomChangeListener, debounceMs = 150): () => void {
    const entry: DebouncedSubscriber = { listener, debounceMs, timer: null };
    this.domSubscribers.add(entry);
    this.ensureDomObserver();

    return () => {
      if (entry.timer !== null) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
      this.domSubscribers.delete(entry);
      if (this.domSubscribers.size === 0) {
        this.domObserver?.disconnect();
        this.domObserver = null;
      }
    };
  }

  private ensureDomObserver(): void {
    if (this.domObserver || !document.body) return;
    this.domObserver = new MutationObserver((mutations) => {
      this.checkUrl();
      const hasChanges = mutations.some(m => m.addedNodes.length > 0 || m.removedNodes.length > 0);
      if (!hasChanges) return;

      for (const sub of this.domSubscribers) {
        if (sub.timer !== null) clearTimeout(sub.timer);
        sub.timer = window.setTimeout(() => {
          sub.timer = null;
          try {
            sub.listener();
          } catch (error) {
            console.error('[PageLifecycle] DOM listener error:', error);
          }
        }, sub.debounceMs);
      }
    });
    this.domObserver.observe(document.body, { childList: true, subtree: true });
  }
}

export const pageLifecycle = new PageLifecycle();
