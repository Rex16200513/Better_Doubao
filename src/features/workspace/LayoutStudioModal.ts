import { settingsService } from '../../core/services/SettingsService';
import {
  DEFAULT_PINNED_SKILLS,
  DEFAULT_SETTINGS,
  THEME_PRESETS,
  type ExtensionSettings,
} from '../../core/types/settings';
import { showToast } from '../../core/utils/ui';
import { workspaceCustomizer } from './WorkspaceCustomizer';

const CLOSE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

export class LayoutStudioModal {
  private overlay: HTMLElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private showAddForm = false;
  private expandCapsules = false;

  open(): void {
    this.close();

    const initial = settingsService.getSettings();
    let draft: ExtensionSettings = {
      ...initial,
      pinnedComposerSkills: [...initial.pinnedComposerSkills],
      customQuickButtons: initial.customQuickButtons.map(b => ({ ...b })),
    };

    const overlay = document.createElement('div');
    overlay.id = 'dbx-layout-studio-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Better Doubao 界面布局与配色定制');

    const modal = document.createElement('div');
    modal.className = 'dbx-studio-modal';
    overlay.appendChild(modal);

    const render = () => {
      modal.replaceChildren();

      // Header
      const header = document.createElement('header');
      header.className = 'dbx-studio-header';
      const titleBox = document.createElement('div');
      const h2 = document.createElement('h2');
      h2.textContent = '界面布局与配色定制';
      const sub = document.createElement('p');
      sub.textContent = '直接在下方豆包界面原型图上点选区块开关，满意后点击「保存并应用」';
      titleBox.append(h2, sub);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'dbx-panel-close';
      closeBtn.innerHTML = CLOSE_SVG;
      closeBtn.title = '关闭';
      closeBtn.addEventListener('click', () => this.close());
      header.append(titleBox, closeBtn);

      // Body
      const body = document.createElement('div');
      body.className = 'dbx-studio-body';

      // 1. Interactive Visual Wireframe
      const stage = document.createElement('div');
      stage.className = 'dbx-wf-stage';
      stage.dataset.previewTheme = draft.themePreset;

      // Sidebar wireframe
      const wfSidebar = document.createElement('div');
      wfSidebar.className = 'dbx-wf-sidebar';

      const wfBrand = document.createElement('div');
      wfBrand.className = 'dbx-wf-brand';
      wfBrand.textContent = '豆包';

      const wfLauncher = this.makeToggleTile(
        draft.enableSidebarLauncher ? '顶部图标收纳 · 已精简' : '顶部原生菜单 · 展开',
        draft.enableSidebarLauncher,
        () => {
          draft.enableSidebarLauncher = !draft.enableSidebarLauncher;
          render();
        }
      );
      wfLauncher.classList.add('dbx-wf-block-launcher');

      const wfFolders = this.makeToggleTile(
        draft.enableFolders ? '分类文件夹 & 色彩圆点 · 开' : '分类文件夹 & 色彩圆点 · 关',
        draft.enableFolders,
        () => {
          draft.enableFolders = !draft.enableFolders;
          render();
        }
      );

      const wfHistory = document.createElement('div');
      wfHistory.className = 'dbx-wf-skeleton-list';
      wfHistory.innerHTML = '<span>最近</span><i></i><i></i><i class="short"></i>';

      const wfFooterPromo = this.makeToggleTile(
        draft.hideSidebarFooter ? '底部推广 · 已隐藏' : '关于豆包 / 下载 · 显示',
        !draft.hideSidebarFooter,
        () => {
          draft.hideSidebarFooter = !draft.hideSidebarFooter;
          render();
        }
      );
      wfFooterPromo.classList.add('dbx-wf-block-footer');

      wfSidebar.append(wfBrand, wfLauncher, wfFolders, wfHistory, wfFooterPromo);

      // Main pane wireframe
      const wfMain = document.createElement('div');
      wfMain.className = 'dbx-wf-main';

      // Topbar wireframe
      const wfTopbar = document.createElement('div');
      wfTopbar.className = 'dbx-wf-topbar';
      const wfTitle = document.createElement('span');
      wfTitle.className = 'dbx-wf-topbar-title';
      wfTitle.textContent = '当前对话标题';

      const wfTopActions = document.createElement('div');
      wfTopActions.className = 'dbx-wf-topbar-actions';

      const wfExportBtn = this.makeToggleTile(
        draft.enableExport ? '导出 · 显示' : '导出 · 隐藏',
        draft.enableExport,
        () => {
          draft.enableExport = !draft.enableExport;
          render();
        }
      );
      const wfDownloadBtn = this.makeToggleTile(
        draft.hideDownloadPromo ? '下载电脑版 · 已隐藏' : '下载电脑版 · 显示',
        !draft.hideDownloadPromo,
        () => {
          draft.hideDownloadPromo = !draft.hideDownloadPromo;
          render();
        }
      );
      wfTopActions.append(wfExportBtn, wfDownloadBtn);
      wfTopbar.append(wfTitle, wfTopActions);

      // Chat area wireframe
      const wfChat = document.createElement('div');
      wfChat.className = 'dbx-wf-chat';

      const wfBubbles = document.createElement('div');
      wfBubbles.className = 'dbx-wf-bubbles';
      wfBubbles.innerHTML = `
        <div class="dbx-wf-bubble-user">示例提问：帮我整理方案要点</div>
        <div class="dbx-wf-bubble-ai">
          <div class="line"></div>
          <div class="line short"></div>
        </div>
      `;
      wfChat.append(wfBubbles);

      // Floating quick capsule bar wireframe
      const wfCapsules = document.createElement('div');
      wfCapsules.className = 'dbx-wf-capsules';
      const capLabel = document.createElement('div');
      capLabel.className = 'dbx-wf-zone-label';
      capLabel.textContent = '对话框上方悬浮胶囊（超过 5 个自动收纳至「+N 更多」）';

      const capRow = document.createElement('div');
      capRow.className = 'dbx-wf-capsule-row';
      const visibleCaps = this.expandCapsules
        ? draft.customQuickButtons
        : draft.customQuickButtons.slice(0, 5);
      for (const item of visibleCaps) {
        const pill = document.createElement('span');
        pill.className = 'dbx-wf-capsule-pill';
        const txt = document.createElement('span');
        txt.textContent = item.label;
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '×';
        rm.title = `删除「${item.label}」`;
        rm.addEventListener('click', () => {
          draft.customQuickButtons = draft.customQuickButtons.filter(b => b.id !== item.id);
          render();
        });
        pill.append(txt, rm);
        capRow.appendChild(pill);
      }
      if (draft.customQuickButtons.length > 5) {
        const moreBadge = document.createElement('button');
        moreBadge.type = 'button';
        moreBadge.className = 'dbx-wf-capsule-more';
        moreBadge.textContent = this.expandCapsules
          ? '收起 ▴'
          : `+${draft.customQuickButtons.length - 5} 更多 ▾`;
        moreBadge.addEventListener('click', () => {
          this.expandCapsules = !this.expandCapsules;
          render();
        });
        capRow.appendChild(moreBadge);
      }

      const addCapBtn = document.createElement('button');
      addCapBtn.type = 'button';
      addCapBtn.className = 'dbx-wf-add-capsule';
      addCapBtn.textContent = this.showAddForm ? '收起添加' : '+ 新增快捷胶囊';
      addCapBtn.addEventListener('click', () => {
        this.showAddForm = !this.showAddForm;
        render();
      });
      capRow.appendChild(addCapBtn);
      wfCapsules.append(capLabel, capRow);

      if (this.showAddForm) {
        const addForm = document.createElement('div');
        addForm.className = 'dbx-wf-add-form';
        const nameInput = document.createElement('input');
        nameInput.placeholder = '胶囊名称（如：总结要点）';
        nameInput.maxLength = 18;
        const promptInput = document.createElement('input');
        promptInput.placeholder = '点击插入的指令（如：请分点总结以上内容：）';
        const confirmAdd = document.createElement('button');
        confirmAdd.type = 'button';
        confirmAdd.className = 'dbx-wf-add-confirm';
        confirmAdd.textContent = '添加';
        confirmAdd.addEventListener('click', () => {
          const label = nameInput.value.trim();
          const prompt = promptInput.value.trim();
          if (!label || !prompt) {
            showToast('请填写胶囊名称和指令内容', 'warning');
            return;
          }
          draft.customQuickButtons.push({ id: `btn_${Date.now()}`, label, prompt });
          this.showAddForm = false;
          render();
        });
        addForm.append(nameInput, promptInput, confirmAdd);
        wfCapsules.appendChild(addForm);
      }

      // Composer wireframe with clickable bottom skill buttons
      const wfComposer = document.createElement('div');
      wfComposer.className = 'dbx-wf-composer';
      const wfComposerTop = document.createElement('div');
      wfComposerTop.className = 'dbx-wf-composer-top';
      wfComposerTop.innerHTML = '<span class="placeholder">发消息…（点击下方任意底栏按钮切换显示/隐藏）</span>';

      const compactToggle = this.makeToggleTile(
        draft.compactInputToolbar ? '精简底栏 · 开' : '精简底栏 · 关（全部显示）',
        draft.compactInputToolbar,
        () => {
          draft.compactInputToolbar = !draft.compactInputToolbar;
          render();
        }
      );
      wfComposerTop.appendChild(compactToggle);

      const wfSkillRow = document.createElement('div');
      wfSkillRow.className = 'dbx-wf-skill-row';
      const skills = workspaceCustomizer.getDetectedSkills();
      for (const skill of skills) {
        const visible = !draft.compactInputToolbar || draft.pinnedComposerSkills.includes(skill);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `dbx-wf-skill-btn${visible ? ' is-on' : ' is-off'}`;
        btn.textContent = skill;
        btn.title = visible ? `点击隐藏「${skill}」` : `点击在底栏显示「${skill}」`;
        btn.addEventListener('click', () => {
          if (!draft.compactInputToolbar) {
            draft.compactInputToolbar = true;
            draft.pinnedComposerSkills = skills.filter(s => s !== skill);
          } else if (draft.pinnedComposerSkills.includes(skill)) {
            draft.pinnedComposerSkills = draft.pinnedComposerSkills.filter(s => s !== skill);
          } else {
            draft.pinnedComposerSkills = [...draft.pinnedComposerSkills, skill];
          }
          render();
        });
        wfSkillRow.appendChild(btn);
      }
      wfComposer.append(wfComposerTop, wfSkillRow);

      wfMain.append(wfTopbar, wfChat, wfCapsules, wfComposer);
      stage.append(wfSidebar, wfMain);
      body.appendChild(stage);

      // 2. Global Theme Palette Picker
      const themeSection = document.createElement('div');
      themeSection.className = 'dbx-studio-theme-section';
      const themeTitle = document.createElement('div');
      themeTitle.className = 'dbx-studio-section-title';
      themeTitle.textContent = '界面整体配色主题';

      const themeGrid = document.createElement('div');
      themeGrid.className = 'dbx-theme-grid';
      for (const theme of THEME_PRESETS) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `dbx-theme-card${draft.themePreset === theme.id ? ' is-selected' : ''}`;
        card.innerHTML = `
          <span class="dbx-theme-preview" style="background:${theme.bg}; border-color:${theme.dark ? '#384052' : '#e2e6ef'}">
            <i style="background:${theme.accent}"></i>
          </span>
          <span class="dbx-theme-name">${theme.name}</span>
        `;
        card.addEventListener('click', () => {
          draft.themePreset = theme.id;
          render();
        });
        themeGrid.appendChild(card);
      }
      themeSection.append(themeTitle, themeGrid);
      body.appendChild(themeSection);

      // Footer
      const footer = document.createElement('footer');
      footer.className = 'dbx-studio-footer';

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'dbx-studio-btn-ghost';
      resetBtn.textContent = '恢复默认';
      resetBtn.addEventListener('click', () => {
        // Reset only Studio-managed layout/theme fields; preserve non-Studio options switches.
        draft = {
          ...draft,
          enableSidebarLauncher: DEFAULT_SETTINGS.enableSidebarLauncher,
          enableFolders: DEFAULT_SETTINGS.enableFolders,
          enableExport: DEFAULT_SETTINGS.enableExport,
          hideDownloadPromo: DEFAULT_SETTINGS.hideDownloadPromo,
          hideSidebarFooter: DEFAULT_SETTINGS.hideSidebarFooter,
          compactInputToolbar: DEFAULT_SETTINGS.compactInputToolbar,
          pinnedComposerSkills: [...DEFAULT_PINNED_SKILLS],
          customQuickButtons: [],
          themePreset: DEFAULT_SETTINGS.themePreset,
        };
        render();
      });

      const rightBtns = document.createElement('div');
      rightBtns.className = 'dbx-studio-footer-right';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'dbx-studio-btn-secondary';
      cancelBtn.textContent = '取消';
      cancelBtn.addEventListener('click', () => this.close());

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'dbx-studio-btn-primary';
      saveBtn.textContent = '保存并应用';
      saveBtn.addEventListener('click', () => void (async () => {
        const needsReload =
          draft.enableSidebarLauncher !== initial.enableSidebarLauncher ||
          draft.enableFolders !== initial.enableFolders ||
          draft.enableExport !== initial.enableExport;

        await settingsService.updateSettings({
          enableSidebarLauncher: draft.enableSidebarLauncher,
          enableFolders: draft.enableFolders,
          enableExport: draft.enableExport,
          hideDownloadPromo: draft.hideDownloadPromo,
          hideSidebarFooter: draft.hideSidebarFooter,
          compactInputToolbar: draft.compactInputToolbar,
          pinnedComposerSkills: draft.pinnedComposerSkills,
          customQuickButtons: draft.customQuickButtons,
          themePreset: draft.themePreset,
        });
        this.close();
        if (needsReload) {
          showToast('布局配置已保存，正在刷新页面生效…', 'success');
          window.setTimeout(() => window.location.reload(), 350);
        } else {
          showToast('界面布局与配色已保存并生效', 'success');
        }
      })());

      rightBtns.append(cancelBtn, saveBtn);
      footer.append(resetBtn, rightBtns);

      modal.append(header, body, footer);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    };
    document.addEventListener('keydown', this.keyHandler, true);

    this.overlay = overlay;
    document.body.appendChild(overlay);
    render();
  }

  private makeToggleTile(text: string, active: boolean, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `dbx-wf-tile${active ? ' is-on' : ' is-off'}`;
    btn.textContent = text;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  close(): void {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
    this.overlay?.remove();
    this.overlay = null;
    this.showAddForm = false;
    this.expandCapsules = false;
  }
}

export const layoutStudioModal = new LayoutStudioModal();
