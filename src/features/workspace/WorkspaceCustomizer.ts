import { settingsService } from '../../core/services/SettingsService';
import { pageLifecycle } from '../../core/services/PageLifecycle';
import type { CustomQuickButton } from '../../core/types/settings';

export const KNOWN_COMPOSER_SKILLS = [
  '对话',
  '项目',
  'PPT 生成',
  '图像生成',
  '帮我写作',
  '视频生成',
  '录音转写',
  '深入研究',
  '编程',
  '翻译',
  '学术搜索',
  '更多技能',
];

function normalizeSkillLabel(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/[›>❯]+$/g, '').trim();
}

export class WorkspaceCustomizer {
  private unsubscribeDom: (() => void) | null = null;
  private unsubscribeSettings: (() => void) | null = null;
  private detectedSkills = new Set<string>(KNOWN_COMPOSER_SKILLS.slice(0, 8));

  init(): void {
    if (this.unsubscribeDom) return;
    this.unsubscribeDom = pageLifecycle.onDomChange(() => this.applyAll(), 120);
    this.unsubscribeSettings = settingsService.subscribe(() => this.applyAll());
    this.applyAll();
  }

  destroy(): void {
    this.unsubscribeDom?.();
    this.unsubscribeDom = null;
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;
    document.querySelectorAll('.dbx-clean-hidden').forEach(el => el.classList.remove('dbx-clean-hidden'));
    document.getElementById('dbx-custom-quick-bar')?.remove();
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
    this.applyPromoVisibility(settings.hideDownloadPromo);
    this.applyComposerSkillVisibility(settings.compactInputToolbar, settings.pinnedComposerSkills);
    this.renderCustomQuickButtons(settings.customQuickButtons);
  }

  private applyPromoVisibility(hidePromo: boolean): void {
    // 1. Topbar "下载电脑版" promo button
    const topCandidates = document.querySelectorAll<HTMLElement>('header button, header a, [class*="header"] button, [class*="header"] a, [class*="border-b"] button, [class*="border-b"] a');
    topCandidates.forEach((el) => {
      if (el.closest('[id^="dbx-"], .dbx-unified-panel')) return;
      const text = el.textContent?.trim() || '';
      if (text === '下载电脑版' || text === '下载客户端' || text.includes('下载电脑版')) {
        el.classList.toggle('dbx-clean-hidden', hidePromo);
      }
    });

    // 2. Sidebar bottom "关于豆包" / download bar
    const sidebar = document.querySelector<HTMLElement>('#flow_chat_sidebar');
    if (sidebar) {
      const footerLabels = Array.from(sidebar.querySelectorAll<HTMLElement>('span, a, button, div'))
        .filter((el) => el.childElementCount === 0 && el.textContent?.trim() === '关于豆包');
      for (const label of footerLabels) {
        const footerRow = label.closest<HTMLElement>('div[class*="border-t"], footer') || label.parentElement?.parentElement;
        if (footerRow && footerRow !== sidebar) {
          footerRow.classList.toggle('dbx-clean-hidden', hidePromo);
        }
      }
    }
  }

  private findComposerRoot(): HTMLElement | null {
    const input = document.querySelector<HTMLElement>(
      '#input-engine-container, div.tiptap.ProseMirror[contenteditable="true"], [data-testid="send_textarea"], textarea'
    );
    if (!input) return null;

    // Walk up a few levels to find the rounded composer card that wraps both the editor and the skill toolbar.
    let cur: HTMLElement | null = input.parentElement;
    let best: HTMLElement | null = input.parentElement;
    for (let depth = 0; depth < 6 && cur && cur !== document.body; depth++) {
      const rect = cur.getBoundingClientRect();
      if (rect.width >= 360 && rect.height >= 72 && rect.height <= 360) {
        best = cur;
        if (cur.querySelectorAll('button, [role="button"]').length >= 4) {
          return cur;
        }
      }
      cur = cur.parentElement;
    }
    return best;
  }

  private applyComposerSkillVisibility(compact: boolean, pinnedSkills: string[]): void {
    const composer = this.findComposerRoot();
    if (!composer) return;

    const pinnedSet = new Set(pinnedSkills.map(normalizeSkillLabel));
    const buttons = Array.from(composer.querySelectorAll<HTMLElement>('button, [role="button"]'));

    for (const btn of buttons) {
      if (btn.closest('#dbx-custom-quick-bar, [id^="dbx-"]')) continue;
      const rawText = btn.textContent?.trim() || '';
      if (!rawText || rawText.length > 16) continue;

      const label = normalizeSkillLabel(rawText);
      // Never hide mode selector like "快速", send/mic icon buttons, or "+" attachment button.
      if (!label || label === '+' || label === '快速' || label === '深度思考' || label === '超能') {
        continue;
      }

      const isKnownSkill = KNOWN_COMPOSER_SKILLS.includes(label);
      const rect = btn.getBoundingClientRect();
      const looksLikeSkillChip = rect.height >= 22 && rect.height <= 46 && btn.querySelector('svg') !== null;

      if (!isKnownSkill && !looksLikeSkillChip) continue;

      this.detectedSkills.add(label);
      const shouldHide = compact && !pinnedSet.has(label);
      // Toggle on the immediate wrapper if it exclusively wraps this button, otherwise the button itself.
      const target =
        btn.parentElement &&
        btn.parentElement !== composer &&
        btn.parentElement.childElementCount === 1 &&
        btn.parentElement.tagName === 'DIV'
          ? btn.parentElement
          : btn;
      target.classList.toggle('dbx-clean-hidden', shouldHide);
    }
  }

  private renderCustomQuickButtons(buttons: CustomQuickButton[]): void {
    const existing = document.getElementById('dbx-custom-quick-bar');
    if (buttons.length === 0) {
      existing?.remove();
      return;
    }

    const composer = this.findComposerRoot();
    if (!composer || !composer.parentElement) return;

    const bar = existing ?? document.createElement('div');
    bar.id = 'dbx-custom-quick-bar';
    bar.setAttribute('aria-label', 'Better Doubao 自定义快捷按钮');

    const signature = buttons.map(b => `${b.id}:${b.label}`).join('|');
    if (bar.dataset.signature !== signature) {
      bar.dataset.signature = signature;
      bar.replaceChildren();
      for (const item of buttons) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'dbx-quick-chip';
        chip.textContent = item.label;
        chip.title = item.prompt;
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.insertPromptIntoInput(item.prompt);
        });
        bar.appendChild(chip);
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
