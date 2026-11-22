import { pageLifecycle } from '../../core/services/PageLifecycle';

const PRIMARY_NAV_ITEMS = [
  '新工作任务',
  '新对话',
  '工作台',
  '定时任务',
  '插件 · 技能 · 伙伴',
  '插件 · 技能 · 连接器 · 伙伴',
];

const SECONDARY_NAV_ITEMS = [
  'AI 创作',
  '资料库',
  'API 服务',
  '云盘',
  '智能体',
  '创作中心',
  '连接器',
];

interface NavTarget {
  label: string;
  control: HTMLElement;
  wrapper: HTMLElement;
}

export class SidebarLauncher {
  private unsubscribeDom: (() => void) | null = null;
  private renderedSignature = '';
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
    this.renderedSignature = '';
    this.renderedControls = [];
    this.hideTooltip();
    this.tooltipEl?.remove();
    this.tooltipEl = null;
    document.getElementById('dbx-sidebar-launcher-shell')?.remove();
    document.querySelectorAll('.dbx-native-nav-hidden').forEach(el => {
      el.classList.remove('dbx-native-nav-hidden');
    });
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

  private resolveNavTarget(labels: HTMLElement[], targetLabel: string): NavTarget | null {
    const span = labels.find(
      (item) =>
        item.textContent?.trim() === targetLabel &&
        !item.closest('#dbx-sidebar-launcher-shell, #dbx-sidebar-launcher')
    );
    if (!span) return null;
    const control =
      span.closest<HTMLElement>('.nav-link-IkIer0') ||
      span.closest<HTMLElement>('a, button, [role="button"]') ||
      span.parentElement;
    if (!control) return null;
    const candidateWrapper =
      control.closest<HTMLElement>('[position]') ||
      control.closest<HTMLElement>('[aria-haspopup="dialog"]') ||
      (control.parentElement && control.parentElement.childElementCount === 1 ? control.parentElement : control);
    const wrapper =
      candidateWrapper && candidateWrapper.querySelectorAll('a, button, [role="button"]').length <= 1
        ? candidateWrapper
        : control;
    return wrapper ? { label: targetLabel, control, wrapper } : null;
  }

  private render(): void {
    const sidebar = document.querySelector<HTMLElement>('#flow_chat_sidebar');
    if (!sidebar) return;

    const labels = Array.from(sidebar.querySelectorAll<HTMLElement>('span.font-medium, span, div'))
      .filter((el) => el.childElementCount === 0 && !el.closest('#dbx-sidebar-launcher-shell, #dbx-sidebar-launcher'));

    const primaryTargets = PRIMARY_NAV_ITEMS
      .map((label) => this.resolveNavTarget(labels, label))
      .filter((item): item is NavTarget => !!item);

    const moreToggle =
      this.resolveNavTarget(labels, '更多') ||
      this.resolveNavTarget(labels, '收起');

    const isExpanded = moreToggle?.label === '收起';

    const secondaryTargets = SECONDARY_NAV_ITEMS
      .map((label) => this.resolveNavTarget(labels, label))
      .filter((item): item is NavTarget => !!item);

    if (!primaryTargets.length && !moreToggle) return;

    const anchorWrapper = (primaryTargets[0] || moreToggle)!.wrapper;
    const anchorParent = anchorWrapper.parentElement;
    if (!anchorParent) return;

    // Clean up legacy id if present from earlier version
    const legacyBar = sidebar.querySelector<HTMLElement>('#dbx-sidebar-launcher');
    if (legacyBar && !legacyBar.closest('#dbx-sidebar-launcher-shell')) {
      legacyBar.remove();
    }

    let shell = sidebar.querySelector<HTMLElement>('#dbx-sidebar-launcher-shell');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'dbx-sidebar-launcher-shell';
    }

    if (shell.parentElement !== anchorParent || shell.nextElementSibling !== anchorWrapper) {
      anchorParent.insertBefore(shell, anchorWrapper);
    }

    // Hide all managed native nav rows so expanding "更多" never breaks sidebar flow.
    const allManaged = [
      ...primaryTargets,
      ...(moreToggle ? [moreToggle] : []),
      ...secondaryTargets,
    ];
    for (const item of allManaged) {
      if (item.wrapper !== shell && item.wrapper !== anchorParent) {
        item.wrapper.classList.add('dbx-native-nav-hidden');
      } else {
        item.control.classList.add('dbx-native-nav-hidden');
      }
    }

    const currentControls = [
      ...primaryTargets.map((t) => t.control),
      ...(moreToggle ? [moreToggle.control] : []),
      ...(isExpanded ? secondaryTargets.map((t) => t.control) : []),
    ];

    const signature = [
      primaryTargets.map((t) => t.label).join(','),
      moreToggle ? moreToggle.label : '',
      isExpanded ? secondaryTargets.map((t) => t.label).join(',') : '',
    ].join('|');

    const controlsUnchanged =
      currentControls.length === this.renderedControls.length &&
      currentControls.every((el, idx) => el === this.renderedControls[idx] && el.isConnected);

    if (signature === this.renderedSignature && controlsUnchanged && shell.childElementCount > 0) {
      return;
    }
    this.renderedSignature = signature;
    this.renderedControls = currentControls;
    this.hideTooltip();
    shell.replaceChildren();

    const triggerNativeByLabel = (label: string, fallback: HTMLElement) => {
      if (fallback.isConnected) {
        fallback.click();
        return;
      }
      const liveSidebar = document.querySelector<HTMLElement>('#flow_chat_sidebar');
      if (!liveSidebar) return;
      const liveLabels = Array.from(liveSidebar.querySelectorAll<HTMLElement>('span.font-medium, span, div'))
        .filter((el) => el.childElementCount === 0 && !el.closest('#dbx-sidebar-launcher-shell, #dbx-sidebar-launcher'));
      const fresh = this.resolveNavTarget(liveLabels, label);
      fresh?.control.click();
    };

    // 1. Fixed primary icon strip (icons never shift position when toggling "更多")
    const bar = document.createElement('div');
    bar.id = 'dbx-sidebar-launcher';
    bar.classList.toggle('is-compact', primaryTargets.length + (moreToggle ? 1 : 0) <= 4);

    for (const { label, control } of primaryTargets) {
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
        triggerNativeByLabel(label, control);
      });
      bar.appendChild(button);
    }

    if (moreToggle) {
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = `dbx-launcher-button dbx-launcher-more-btn${isExpanded ? ' is-expanded' : ''}`;
      const tooltipText = isExpanded ? '收起更多' : '更多';
      toggleBtn.setAttribute('aria-label', tooltipText);
      toggleBtn.setAttribute('aria-expanded', String(isExpanded));
      const icon = moreToggle.control.querySelector('svg')?.cloneNode(true);
      if (icon) toggleBtn.appendChild(icon);
      toggleBtn.addEventListener('mouseenter', () => this.showTooltip(toggleBtn, tooltipText));
      toggleBtn.addEventListener('mouseleave', () => this.hideTooltip());
      toggleBtn.addEventListener('focus', () => this.showTooltip(toggleBtn, tooltipText));
      toggleBtn.addEventListener('blur', () => this.hideTooltip());
      toggleBtn.addEventListener('click', () => {
        this.hideTooltip();
        triggerNativeByLabel(moreToggle.label, moreToggle.control);
      });
      bar.appendChild(toggleBtn);
    }

    shell.appendChild(bar);

    // 2. Clean 2-column compact drawer for secondary items when expanded
    if (isExpanded && secondaryTargets.length > 0) {
      const drawer = document.createElement('div');
      drawer.id = 'dbx-sidebar-launcher-drawer';
      for (const { label, control } of secondaryTargets) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'dbx-launcher-drawer-item';
        const icon = control.querySelector('svg')?.cloneNode(true);
        if (icon) chip.appendChild(icon);
        const text = document.createElement('span');
        text.textContent = label;
        chip.appendChild(text);
        chip.addEventListener('click', () => {
          triggerNativeByLabel(label, control);
        });
        drawer.appendChild(chip);
      }
      shell.appendChild(drawer);
    }
  }
}

export const sidebarLauncher = new SidebarLauncher();
