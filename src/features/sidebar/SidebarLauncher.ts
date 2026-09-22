const NAV_ITEMS = [
  '新工作任务', '新对话', 'AI 创作', '定时任务', '插件 · 技能 · 伙伴', '插件 · 技能 · 连接器 · 伙伴', 'API 服务'
];

export class SidebarLauncher {
  private observer: MutationObserver | null = null;
  private timer: number | null = null;
  private renderedControls: HTMLElement[] = [];

  init(): void {
    if (this.observer) return;
    this.observer = new MutationObserver(() => {
      if (this.timer) window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.render(), 100);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.render();
  }

  private render(): void {
    const sidebar = document.querySelector<HTMLElement>('#flow_chat_sidebar');
    if (!sidebar) return;

    const labels = Array.from(sidebar.querySelectorAll<HTMLElement>('span.font-medium'));
    const targets = NAV_ITEMS.map((label) => {
      const span = labels
        .find((item) => item.textContent?.trim() === label && !item.closest('#dbx-sidebar-launcher'));
      const control = span?.closest<HTMLElement>('.nav-link-IkIer0');
      const wrapper = control?.closest<HTMLElement>('[position]') ||
        control?.closest<HTMLElement>('[aria-haspopup="dialog"]') || control?.parentElement;
      return control && wrapper ? { label, control, wrapper } : null;
    }).filter((item): item is { label: string; control: HTMLElement; wrapper: HTMLElement } => !!item);

    if (!targets.length) return;
    const first = targets[0].wrapper;
    let bar = sidebar.querySelector<HTMLElement>('#dbx-sidebar-launcher');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'dbx-sidebar-launcher';
    }
    if (bar.parentElement !== first.parentElement || bar.nextElementSibling !== first) {
      first.parentElement?.insertBefore(bar, first);
    }

    const controlsChanged = bar.childElementCount !== targets.length ||
      targets.some(({ control }, index) => this.renderedControls[index] !== control);
    if (controlsChanged) {
      bar.replaceChildren();
      for (const { label, control } of targets) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dbx-launcher-button';
        button.setAttribute('aria-label', label);
        button.dataset.label = label;
        const icon = control.querySelector('svg')?.cloneNode(true);
        if (icon) button.appendChild(icon);
        button.addEventListener('click', () => control.click());
        bar.appendChild(button);
      }
      this.renderedControls = targets.map(({ control }) => control);
    }

    for (const { wrapper } of targets) wrapper.classList.add('dbx-native-nav-hidden');
  }
}

export const sidebarLauncher = new SidebarLauncher();
