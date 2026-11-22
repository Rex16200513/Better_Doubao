import { settingsService } from '../../core/services/SettingsService';
import { pageLifecycle } from '../../core/services/PageLifecycle';
import type { CustomQuickButton, ThemePreset } from '../../core/types/settings';

export const KNOWN_COMPOSER_SKILLS = [
  '对话',
  '项目',
  'PPT 生成',
  '图像生成',
  '帮我写作',
  '视频生成',
  '音乐生成',
  '录音转写',
  '深入研究',
  '编程',
  '翻译',
  '学术搜索',
  'AI 播客',
  'AI 表格',
  '更多技能',
];

const KNOWN_SKILL_SET = new Set(KNOWN_COMPOSER_SKILLS);
const MAX_INLINE_CAPSULES = 5;

function normalizeSkillLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/[›>❯]+$/g, '').trim();
}

function isNearWhiteOpaque(bg: string): boolean {
  const m = bg.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (!m) return false;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] !== undefined ? Number(m[4]) : 1;
  return a >= 0.75 && r >= 238 && g >= 238 && b >= 238;
}

function hasWhiteGradient(bgImage: string): boolean {
  if (!bgImage || bgImage === 'none') return false;
  const lower = bgImage.toLowerCase();
  return lower.includes('gradient') && (
    lower.includes('255, 255, 255') ||
    lower.includes('255,255,255') ||
    lower.includes('#fff') ||
    lower.includes('white')
  );
}

export class WorkspaceCustomizer {
  private unsubscribeDom: (() => void) | null = null;
  private unsubscribeSettings: (() => void) | null = null;
  private detectedSkills = new Set<string>([
    '对话',
    '项目',
    'PPT 生成',
    '图像生成',
    '帮我写作',
    '视频生成',
    '音乐生成',
    '录音转写',
    '更多技能',
  ]);
  private morePopoverOpen = false;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;
  private resizeHandler: (() => void) | null = null;

  init(): void {
    if (this.unsubscribeDom) return;
    this.unsubscribeDom = pageLifecycle.onDomChange(() => this.applyAll(), 120);
    this.unsubscribeSettings = settingsService.subscribe(() => this.applyAll());
    this.outsideClickHandler = (e: MouseEvent) => {
      if (!this.morePopoverOpen) return;
      const target = e.target as Element | null;
      if (!target?.closest('#dbx-custom-quick-bar')) {
        this.closeMorePopover();
      }
    };
    this.resizeHandler = () => {
      const bar = document.getElementById('dbx-custom-quick-bar');
      const composer = this.findComposerRoot();
      if (bar && composer) this.syncQuickBarAlignment(bar, composer);
    };
    document.addEventListener('click', this.outsideClickHandler);
    window.addEventListener('resize', this.resizeHandler);
    this.applyAll();
  }

  destroy(): void {
    this.unsubscribeDom?.();
    this.unsubscribeDom = null;
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    document.querySelectorAll('.dbx-clean-hidden').forEach(el => el.classList.remove('dbx-clean-hidden'));
    this.clearThemeSurfaces();
    document.getElementById('dbx-custom-quick-bar')?.remove();
    delete document.documentElement.dataset.dbxTheme;
  }

  getDetectedSkills(): string[] {
    const ordered: string[] = [];
    for (const known of KNOWN_COMPOSER_SKILLS) {
      if (this.detectedSkills.has(known)) ordered.push(known);
    }
    for (const extra of this.detectedSkills) {
      if (!ordered.includes(extra)) ordered.push(extra);
    }
    return ordered;
  }

  applyAll(): void {
    const settings = settingsService.getSettings();
    this.applyTheme(settings.themePreset);
    this.applyPromoVisibility(settings.hideDownloadPromo, settings.hideSidebarFooter);
    this.applyComposerSkillVisibility(settings.compactInputToolbar, settings.pinnedComposerSkills);
    this.renderCustomQuickButtons(settings.customQuickButtons);
  }

  private clearThemeSurfaces(): void {
    document.querySelectorAll<HTMLElement>('[data-dbx-surface]').forEach((el) => {
      delete el.dataset.dbxSurface;
    });
  }

  applyTheme(preset: ThemePreset): void {
    if (!preset || preset === 'default') {
      delete document.documentElement.dataset.dbxTheme;
      this.clearThemeSurfaces();
      return;
    }
    document.documentElement.dataset.dbxTheme = preset;
    this.tagThemeSurfaces();
  }

  /**
   * Tag Doubao's structural white containers (topbar, main chat canvas, white gradient masks,
   * sidebar, active sidebar item, and the exact rounded composer card) so theme CSS harmonizes
   * the whole workspace evenly without leftover white rectangles.
   */
  private tagThemeSurfaces(): void {
    const sidebar = document.querySelector<HTMLElement>('#flow_chat_sidebar');
    const composer = this.findComposerRoot();

    if (sidebar) {
      sidebar.dataset.dbxSurface = 'sidebar';
      const sidebarWidth = sidebar.getBoundingClientRect().width;
      const sidebarChildren = sidebar.querySelectorAll<HTMLElement>('div, nav, aside, footer, section');
      for (const el of sidebarChildren) {
        if (el.closest('[id^="dbx-"]')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 26) continue;
        const bg = window.getComputedStyle(el).backgroundColor;
        if (!isNearWhiteOpaque(bg)) continue;
        if (rect.height <= 56 && rect.width < sidebarWidth - 4) {
          el.dataset.dbxSurface = 'sidebar-active';
        } else {
          el.dataset.dbxSurface = 'sidebar';
        }
      }
    }

    if (composer) {
      composer.dataset.dbxSurface = 'composer';
      // Clear any inner pure-white wrapper inside the rounded composer card so the card tint shows cleanly.
      const innerWhite = composer.querySelectorAll<HTMLElement>('div, section, form');
      for (const inner of innerWhite) {
        if (inner.closest('button, [role="button"], [id^="dbx-"]')) continue;
        const r = inner.getBoundingClientRect();
        if (r.width < 120 || r.height < 24) continue;
        const style = window.getComputedStyle(inner);
        if (isNearWhiteOpaque(style.backgroundColor)) {
          inner.dataset.dbxSurface = 'composer-inner';
        }
      }
      // Make square white / white-gradient dock wrappers immediately behind the rounded composer
      // transparent so no sharp white corners ever stick out behind the rounded composer card.
      let ancestor: HTMLElement | null = composer.parentElement;
      for (let depth = 0; depth < 4 && ancestor && ancestor !== document.body; depth++) {
        if (ancestor.tagName === 'MAIN') break;
        const aStyle = window.getComputedStyle(ancestor);
        const aRadius = parseFloat(aStyle.borderTopLeftRadius || '0');
        if (aRadius < 12 && (isNearWhiteOpaque(aStyle.backgroundColor) || hasWhiteGradient(aStyle.backgroundImage))) {
          ancestor.dataset.dbxSurface = 'composer-dock';
        }
        ancestor = ancestor.parentElement;
      }
    }

    const containers = document.querySelectorAll<HTMLElement>('main, header, section, div');
    for (const el of containers) {
      if (el.dataset.dbxSurface) continue;
      if (el.closest('#flow_chat_sidebar, [id^="dbx-"], .dbx-unified-panel, [data-message-id], pre, code, table, button, [role="button"], [role="tablist"], [role="dialog"]')) {
        continue;
      }
      if (composer && (el === composer || composer.contains(el))) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < 64 || rect.height < 24) continue;

      const style = window.getComputedStyle(el);
      const radius = parseFloat(style.borderTopLeftRadius || '0');
      const hasShadow = style.boxShadow && style.boxShadow !== 'none';

      // Preserve intentional pill toggles / floating popover cards (e.g. "对话 | 工作" segmented control).
      if (radius >= 16 && (hasShadow || rect.height <= 64) && rect.width < 420) continue;

      if (hasWhiteGradient(style.backgroundImage)) {
        el.dataset.dbxSurface = 'fade-mask';
        continue;
      }

      if (!isNearWhiteOpaque(style.backgroundColor)) continue;

      if (rect.top <= 16 && rect.height <= 84 && rect.width >= 260) {
        el.dataset.dbxSurface = 'topbar';
      } else {
        el.dataset.dbxSurface = 'canvas';
      }
    }
  }

  private applyPromoVisibility(hideTopDownload: boolean, hideSidebarFooter: boolean): void {
    // 1. Topbar "下载电脑版" promo button
    const topCandidates = document.querySelectorAll<HTMLElement>(
      'header button, header a, [class*="header"] button, [class*="header"] a, [class*="border-b"] button, [class*="border-b"] a'
    );
    topCandidates.forEach((el) => {
      if (el.closest('[id^="dbx-"], .dbx-unified-panel')) return;
      const text = el.textContent?.trim() || '';
      if (text === '下载电脑版' || text === '下载客户端' || text.includes('下载电脑版')) {
        el.classList.toggle('dbx-clean-hidden', hideTopDownload);
      }
    });

    // 2. Sidebar bottom "关于豆包" / download footer bar
    const sidebar = document.querySelector<HTMLElement>('#flow_chat_sidebar');
    if (sidebar) {
      const footerLabels = Array.from(sidebar.querySelectorAll<HTMLElement>('span, a, button, div'))
        .filter((el) => el.childElementCount === 0 && el.textContent?.trim() === '关于豆包');
      for (const label of footerLabels) {
        const footerRow = label.closest<HTMLElement>('div[class*="border-t"], footer') || label.parentElement?.parentElement;
        if (footerRow && footerRow !== sidebar) {
          footerRow.classList.toggle('dbx-clean-hidden', hideSidebarFooter);
        }
      }
    }
  }

  /**
   * Locate the exact visible rounded composer card wrapping both the text editor AND
   * the bottom toolbar across all Doubao modes (Chat, Work, Image/Video AI creation, etc.).
   */
  private findComposerRoot(): HTMLElement | null {
    const input = document.querySelector<HTMLElement>(
      '#input-engine-container, div.tiptap.ProseMirror[contenteditable="true"], [data-testid="send_textarea"], textarea, [contenteditable="true"]'
    );
    if (!input) return null;

    let cur: HTMLElement | null = input.parentElement;
    let fallback: HTMLElement | null = input.parentElement;
    let bestRoundedCard: HTMLElement | null = null;
    let skillContainer: HTMLElement | null = null;

    for (let depth = 0; depth < 10 && cur && cur !== document.body; depth++) {
      const rect = cur.getBoundingClientRect();
      if (rect.width >= 340 && rect.height >= 64 && rect.height <= 360) {
        const style = window.getComputedStyle(cur);
        const radius = parseFloat(style.borderTopLeftRadius || '0');
        const border = parseFloat(style.borderTopWidth || '0');
        const hasCardLook = border > 0 || isNearWhiteOpaque(style.backgroundColor) || style.boxShadow !== 'none';
        const buttonCount = cur.querySelectorAll('button, [role="button"]').length;

        // The real composer card always has rounded corners (>= 14px) and wraps editor + controls.
        if (radius >= 14 && hasCardLook && (buttonCount >= 1 || rect.height >= 80)) {
          bestRoundedCard = cur;
        }

        const text = cur.textContent || '';
        const hasToolbar =
          text.includes('对话') ||
          text.includes('PPT 生成') ||
          text.includes('图像生成') ||
          text.includes('更多技能') ||
          text.includes('云电脑') ||
          text.includes('插件') ||
          text.includes('技能') ||
          text.includes('项目') ||
          text.includes('模型') ||
          text.includes('自动比例');

        if (hasToolbar && !skillContainer) {
          skillContainer = cur;
        }
        if (radius >= 14) {
          fallback = cur;
        }
      }
      cur = cur.parentElement;
    }
    return bestRoundedCard || skillContainer || fallback;
  }

  private applyComposerSkillVisibility(compact: boolean, pinnedSkills: string[]): void {
    const composer = this.findComposerRoot();
    if (!composer) return;

    const pinnedSet = new Set(pinnedSkills.map(normalizeSkillLabel));
    const handledTargets = new Set<HTMLElement>();

    const leaves = Array.from(composer.querySelectorAll<HTMLElement>('span, div, button, a, p'));
    for (const leaf of leaves) {
      if (leaf.closest('#dbx-custom-quick-bar, [id^="dbx-"], [contenteditable="true"]')) continue;
      if (leaf.childElementCount > 0) continue;

      const label = normalizeSkillLabel(leaf.textContent || '');
      if (!label || !KNOWN_SKILL_SET.has(label)) continue;

      let chip: HTMLElement | null = leaf;
      let cur: HTMLElement | null = leaf.parentElement;
      for (let depth = 0; depth < 4 && cur && cur !== composer; depth++) {
        const rect = cur.getBoundingClientRect();
        const curText = normalizeSkillLabel(cur.textContent || '');
        if (curText === label && rect.width <= 165 && rect.height >= 20 && rect.height <= 48) {
          chip = cur;
        } else if (curText !== label) {
          break;
        }
        cur = cur.parentElement;
      }

      if (!chip || handledTargets.has(chip)) continue;
      handledTargets.add(chip);
      this.detectedSkills.add(label);

      const shouldHide = compact && !pinnedSet.has(label);
      chip.classList.toggle('dbx-clean-hidden', shouldHide);
    }
  }

  private closeMorePopover(): void {
    this.morePopoverOpen = false;
    document.querySelector('.dbx-quick-more-popover')?.remove();
    document.querySelector('.dbx-quick-more-btn')?.setAttribute('aria-expanded', 'false');
  }

  /**
   * Closed-loop alignment: reset marginLeft to 0, measure bar's natural left edge,
   * and shift by the exact delta to composer's left edge (0px drift under any layout).
   */
  private syncQuickBarAlignment(bar: HTMLElement, composer: HTMLElement): void {
    const composerRect = composer.getBoundingClientRect();
    if (composerRect.width < 120) return;

    bar.style.alignSelf = 'flex-start';
    bar.style.width = `${Math.round(composerRect.width)}px`;
    bar.style.marginLeft = '0px';
    bar.style.marginRight = 'auto';

    const baseLeft = bar.getBoundingClientRect().left;
    const neededOffset = Math.round(composerRect.left - baseLeft);
    if (Math.abs(neededOffset) > 1) {
      bar.style.marginLeft = `${neededOffset}px`;
    }
  }

  private renderCustomQuickButtons(buttons: CustomQuickButton[]): void {
    const existing = document.getElementById('dbx-custom-quick-bar');
    if (buttons.length === 0) {
      existing?.remove();
      this.morePopoverOpen = false;
      return;
    }

    const composer = this.findComposerRoot();
    if (!composer || !composer.parentElement) return;

    const bar = existing ?? document.createElement('div');
    bar.id = 'dbx-custom-quick-bar';
    bar.setAttribute('aria-label', 'Better Doubao 快捷指令胶囊');

    const signature = buttons.map(b => `${b.id}:${b.label}:${b.prompt}`).join('|');
    if (bar.dataset.signature !== signature) {
      bar.dataset.signature = signature;
      bar.replaceChildren();
      this.morePopoverOpen = false;

      const visible = buttons.slice(0, MAX_INLINE_CAPSULES);
      const overflow = buttons.slice(MAX_INLINE_CAPSULES);

      const makeChip = (item: CustomQuickButton): HTMLButtonElement => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'dbx-quick-chip';
        chip.textContent = item.label;
        chip.title = item.prompt;
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.closeMorePopover();
          this.insertPromptIntoInput(item.prompt);
        });
        return chip;
      };

      for (const item of visible) {
        bar.appendChild(makeChip(item));
      }

      if (overflow.length > 0) {
        const moreWrap = document.createElement('div');
        moreWrap.className = 'dbx-quick-more-wrap';

        const moreBtn = document.createElement('button');
        moreBtn.type = 'button';
        moreBtn.className = 'dbx-quick-chip dbx-quick-more-btn';
        moreBtn.setAttribute('aria-expanded', 'false');
        moreBtn.textContent = `+${overflow.length} 更多 ▾`;
        moreBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.morePopoverOpen) {
            this.closeMorePopover();
            return;
          }
          const popover = document.createElement('div');
          popover.className = 'dbx-quick-more-popover';
          for (const extra of overflow) {
            popover.appendChild(makeChip(extra));
          }
          moreWrap.appendChild(popover);
          this.morePopoverOpen = true;
          moreBtn.setAttribute('aria-expanded', 'true');
        });

        moreWrap.appendChild(moreBtn);
        bar.appendChild(moreWrap);
      }
    }

    if (bar.parentElement !== composer.parentElement || bar.nextElementSibling !== composer) {
      composer.parentElement.insertBefore(bar, composer);
    }
    this.syncQuickBarAlignment(bar, composer);
  }

  private insertPromptIntoInput(text: string): void {
    const contenteditable = document.querySelector<HTMLElement>(
      '#input-engine-container div[contenteditable="true"], div.tiptap.ProseMirror[contenteditable="true"], div[contenteditable="true"]'
    );
    if (contenteditable) {
      contenteditable.focus();
      let inserted = false;
      try {
        inserted = document.execCommand('insertText', false, text);
      } catch {
        inserted = false;
      }
      if (!inserted) {
        const current = contenteditable.textContent || '';
        contenteditable.textContent = current ? `${current}\n${text}` : text;
        contenteditable.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
      return;
    }

    const textarea = document.querySelector<HTMLTextAreaElement>('[data-testid="send_textarea"], textarea');
    if (textarea) {
      const current = textarea.value;
      textarea.value = current ? `${current}\n${text}` : text;
      textarea.focus();
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

export const workspaceCustomizer = new WorkspaceCustomizer();
