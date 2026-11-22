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
const POPOVER_SELECTOR =
  '[role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [class*="popover"], [class*="popup"], [class*="dropdown"], [class*="drawer"], [class*="modal"]';

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

function isSkillPopupContainer(el: HTMLElement): boolean {
  if (el.matches(POPOVER_SELECTOR) || !!el.closest(POPOVER_SELECTOR)) return true;
  const text = el.textContent || '';
  return text.includes('快捷功能 (') || text.includes('技能 (');
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
   * Minimal surgical surface tagging (the heavy lifting is done natively via Doubao's
   * own --dbx-* and --s-color-* CSS design tokens in content.css, so popovers/dialogs
   * like "更多技能" always stay properly opaque and layered).
   */
  private tagThemeSurfaces(): void {
    const sidebar = document.querySelector<HTMLElement>('#flow_chat_sidebar');
    if (sidebar) {
      sidebar.dataset.dbxSurface = 'sidebar';
    }

    const composer = this.findComposerRoot();
    if (composer) {
      composer.dataset.dbxSurface = 'composer';
      // Ensure square white dock containers immediately behind the rounded composer don't show white corners
      let ancestor: HTMLElement | null = composer.parentElement;
      for (let depth = 0; depth < 3 && ancestor && ancestor !== document.body; depth++) {
        if (ancestor.tagName === 'MAIN' || isSkillPopupContainer(ancestor)) break;
        const aStyle = window.getComputedStyle(ancestor);
        const aRadius = parseFloat(aStyle.borderTopLeftRadius || '0');
        if (aRadius < 12 && isNearWhiteOpaque(aStyle.backgroundColor)) {
          ancestor.dataset.dbxSurface = 'composer-dock';
        }
        ancestor = ancestor.parentElement;
      }
    }
  }

  private applyPromoVisibility(hideTopDownload: boolean, hideSidebarFooter: boolean): void {
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
   * Locate the exact visible rounded chat composer card (strictly anchored on the main
   * message editor and never matching popovers like the "更多技能" drawer or its search box).
   */
  private findComposerRoot(): HTMLElement | null {
    const editors = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#input-engine-container, div.tiptap.ProseMirror[contenteditable="true"], [data-testid="send_textarea"], textarea[placeholder*="发消息"], textarea[placeholder*="描述"], textarea[placeholder*="创建任务"]'
      )
    ).filter((el) => !el.closest(POPOVER_SELECTOR) && !el.closest('[id^="dbx-"]'));

    const input = editors[0];
    if (!input) return null;

    let cur: HTMLElement | null = input.parentElement;
    let fallback: HTMLElement | null = input.parentElement;
    let bestRoundedCard: HTMLElement | null = null;

    for (let depth = 0; depth < 9 && cur && cur !== document.body; depth++) {
      if (isSkillPopupContainer(cur)) break;

      const rect = cur.getBoundingClientRect();
      if (rect.width >= 340 && rect.height >= 64 && rect.height <= 320) {
        const style = window.getComputedStyle(cur);
        const radius = parseFloat(style.borderTopLeftRadius || '0');
        const border = parseFloat(style.borderTopWidth || '0');
        const hasCardLook = border > 0 || isNearWhiteOpaque(style.backgroundColor) || style.boxShadow !== 'none';
        const buttonCount = cur.querySelectorAll('button, [role="button"]').length;

        if (radius >= 14 && hasCardLook && (buttonCount >= 1 || rect.height >= 76)) {
          bestRoundedCard = cur;
        }
        if (radius >= 14) {
          fallback = cur;
        }
      }
      cur = cur.parentElement;
    }
    return bestRoundedCard || fallback;
  }

  private applyComposerSkillVisibility(compact: boolean, pinnedSkills: string[]): void {
    // First clean up any previously hidden elements that live inside an open popover/drawer.
    document.querySelectorAll<HTMLElement>('.dbx-clean-hidden').forEach((el) => {
      if (isSkillPopupContainer(el)) {
        el.classList.remove('dbx-clean-hidden');
      }
    });

    const composer = this.findComposerRoot();
    if (!composer) return;

    const composerRect = composer.getBoundingClientRect();
    const pinnedSet = new Set(pinnedSkills.map(normalizeSkillLabel));
    const handledTargets = new Set<HTMLElement>();

    // Restore or re-evaluate previously tagged skill chips first (even when hidden with height 0).
    composer.querySelectorAll<HTMLElement>('[data-dbx-skill-chip]').forEach((chip) => {
      if (isSkillPopupContainer(chip)) {
        chip.classList.remove('dbx-clean-hidden');
        delete chip.dataset.dbxSkillChip;
        return;
      }
      const label = chip.dataset.dbxSkillChip || '';
      if (!label) return;
      handledTargets.add(chip);
      this.detectedSkills.add(label);
      const shouldHide = compact && !pinnedSet.has(label);
      chip.classList.toggle('dbx-clean-hidden', shouldHide);
    });

    const leaves = Array.from(composer.querySelectorAll<HTMLElement>('span, div, button, a, p'));
    for (const leaf of leaves) {
      if (leaf.closest('#dbx-custom-quick-bar, [id^="dbx-"], [contenteditable="true"]')) continue;
      if (isSkillPopupContainer(leaf)) continue;
      if (leaf.childElementCount > 0) continue;

      const label = normalizeSkillLabel(leaf.textContent || '');
      if (!label || !KNOWN_SKILL_SET.has(label)) continue;

      // Only target chips in the bottom toolbar row of the composer (never popovers above it).
      const leafRect = leaf.getBoundingClientRect();
      if (leafRect.height > 0 && leafRect.top < composerRect.bottom - 64) continue;

      let chip: HTMLElement | null = leaf;
      let cur: HTMLElement | null = leaf.parentElement;
      for (let depth = 0; depth < 4 && cur && cur !== composer; depth++) {
        if (isSkillPopupContainer(cur)) {
          chip = null;
          break;
        }
        const rect = cur.getBoundingClientRect();
        const curText = normalizeSkillLabel(cur.textContent || '');
        const isTrackedHidden =
          cur.dataset.dbxSkillChip === label || cur.classList.contains('dbx-clean-hidden');
        if (
          curText === label &&
          (isTrackedHidden || (rect.width <= 165 && rect.height >= 20 && rect.height <= 48))
        ) {
          chip = cur;
        } else if (curText !== label) {
          break;
        }
        cur = cur.parentElement;
      }

      if (!chip || handledTargets.has(chip)) continue;
      handledTargets.add(chip);
      chip.dataset.dbxSkillChip = label;
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
      '#input-engine-container div[contenteditable="true"], div.tiptap.ProseMirror[contenteditable="true"]'
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
