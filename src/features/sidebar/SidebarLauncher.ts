import { pageLifecycle } from '../../core/services/PageLifecycle';

const NAV_ITEMS = [
  '新工作任务',
  '新对话',
  '更多',
  'AI 创作',
  '定时任务',
  '插件 · 技能 · 伙伴',
  '插件 · 技能 · 连接器 · 伙伴',
  'API 服务',
];

export class SidebarLauncher {
  private unsubscribeDom: (() => void) | null = null;
  private renderedControls: HTMLElement[] = [];
  private tooltipEl: HTMLElement | null = null;

  init(): void {
    if (this.unsubscribeDom) return;
    this.unsubscribeDom = pageLifecycle.onDomChange(() => this.render(), 100);
    this.render();
  }

  destroy(): void {
    this.unsubscribeDom?.();
    this.unsubscribeDom = null;
    this.renderedControls = [];
    this.hideTooltip();
    this.tooltipEl?.remove();
    this.tooltipEl = null;
  }

  private showTooltip(button: HTMLElement, label: string): void {
    if (!this.tooltipEl) {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.id = 'dbx-launcher-tooltip';
      this.tooltipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(this.tooltipEl);
    }

    this.tooltipEl.textContent = label;
    this.tooltipEl.classList.add('is-visible');

    const btnRect = button.getBoundingClientRect();
    const tipRect = this.tooltipEl.getBoundingClientRect();
    const rawLeft = btnRect.left + btnRect.width / 2 - tipRect.width / 2;
    const maxLeft = Math.max(8, window.innerWidth - tipRect.width - 8);
    const left = Math.min(Math.max(8, rawLeft), maxLeft);
    const top = Math.min(window.innerHeight - tipRect.height - 8, btnRect.bottom + 8);

    this.tooltipEl.style.left = `${left}px`;
    this.tooltipEl.style.top = `${top}px`;
  }

  private hideTooltip(): void {
    this.tooltipEl?.classList.remove('is-visible');
  }

  private render(): void {
    const sidebar = document.querySelector<HTMLElement>('#flow_chat_sidebar');
    if (!sidebar) return;

    const labels = Array.from(sidebar.querySelectorAll<HTMLElement>('span.font-medium'));
    const targets = NAV_ITEMS.map((label) => {
      const span = labels
        .find((item) => item.textContent?.trim() === label && !item.closest('#dbx-sidebar-launcher'));
      const control = span?.closest<HTMLElement>('.nav-link-IkIer0') || span?.closest<HTMLElement>('a, button, [role="button"]');
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
    bar.classList.toggle('is-compact', targets.length <= 4);

    if (bar.parentElement !== first.parentElement || bar.nextElementSibling !== first) {
      first.parentElement?.insertBefore(bar, first);
    }

    const controlsChanged = bar.childElementCount !== targets.length ||
      targets.some(({ control }, index) => this.renderedControls[index] !== control);
    if (controlsChanged) {
      this.hideTooltip();
      bar.replaceChildren();
      for (const { label, control } of targets) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dbx-launcher-button';
        button.setAttribute('aria-label', label);
        const icon = control.querySelector('svg')?.cloneNode(true);
        if (icon) button.appendChild(icon);
        button.addEventListener('mouseenter', () => this.showTooltip(button, label));
        button.addEventListener('mouseleave', () => this.hideTooltip());
        button.addEventListener('focus', () => this.showTooltip(button, label));
        button.addEventListener('blur', () => this.hideTooltip());
        button.addEventListener('click', () => {
          this.hideTooltip();
          control.click();
        });
        bar.appendChild(button);
      }
      this.renderedControls = targets.map(({ control }) => control);
    }

    for (const { wrapper } of targets) wrapper.classList.add('dbx-native-nav-hidden');
  }
}

export const sidebarLauncher = new SidebarLauncher();
