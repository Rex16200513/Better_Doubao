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
    document.addEventListener('click', this.outsideClickHandler);
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
    document.querySelectorAll('.dbx-clean-hidden').forEach(el => el.classList.remove('dbx-clean-hidden'));
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

  applyTheme(preset: ThemePreset): void {
    if (!preset || preset === 'default') {
      delete document.documentElement.dataset.dbxTheme;
    } else {
      document.documentElement.dataset.dbxTheme = preset;
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
   * Locate the full rounded composer card that wraps both the text editor AND the bottom
   * skill bar (对话 / 项目 / PPT 生成 / 图像生成 / ...).
   */
  private findComposerRoot(): HTMLElement | null {
    const input = document.querySelector<HTMLElement>(
      '#input-engine-container, div.tiptap.ProseMirror[contenteditable="true"], [data-testid="send_textarea"], textarea'
    );
    if (!input) return null;

    let cur: HTMLElement | null = input.parentElement;
    let fallback: HTMLElement | null = input.parentElement;
    for (let depth = 0; depth < 9 && cur && cur !== document.body; depth++) {
      const rect = cur.getBoundingClientRect();
      if (rect.width >= 380 && rect.height >= 72 && rect.height <= 340) {
        fallback = cur;
        const text = cur.textContent || '';
        const hasSkillMarkers =
          (text.includes('对话') || text.includes('PPT 生成') || text.includes('图像生成') || text.includes('更多技能'));
        if (hasSkillMarkers) {
          return cur;
        }
      }
      cur = cur.parentElement;
    }
    return fallback;
  }

  private applyComposerSkillVisibility(compact: boolean, pinnedSkills: string[]): void {
    const composer = this.findComposerRoot();
    if (!composer) return;

    const pinnedSet = new Set(pinnedSkills.map(normalizeSkillLabel));
    const handledTargets = new Set<HTMLElement>();

    // Scan leaf text nodes inside the composer so we work regardless of whether Doubao renders
    // each skill chip as a <button>, <div>, or <span>.
    const leaves = Array.from(composer.querySelectorAll<HTMLElement>('span, div, button, a, p'));
    for (const leaf of leaves) {
      if (leaf.closest('#dbx-custom-quick-bar, [id^="dbx-"], [contenteditable="true"]')) continue;
      if (leaf.childElementCount > 0) continue;

      const label = normalizeSkillLabel(leaf.textContent || '');
      if (!label || !KNOWN_SKILL_SET.has(label)) continue;

      // Walk up 1-3 levels to find the clickable skill pill wrapper (contains icon + label).
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
