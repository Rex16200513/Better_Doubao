import { settingsService } from '../../core/services/SettingsService';
import type { ExtensionSettings } from '../../core/types/settings';

const SETTING_KEYS: Array<keyof ExtensionSettings> = [
  'enableSidebarLauncher',
  'enableQuickLocator',
  'autoIndexLongChat',
  'enableFolderManager',
  'enableCorpusAndHighlight',
  'enableExport',
  'enableLatexDownloader',
];

async function initOptions(): Promise<void> {
  const statusEl = document.getElementById('status');
  const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement | null;

  const showStatus = (text: string) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.add('visible');
    window.setTimeout(() => statusEl.classList.remove('visible'), 2500);
  };

  const renderValues = (settings: ExtensionSettings) => {
    for (const key of SETTING_KEYS) {
      const input = document.getElementById(key) as HTMLInputElement | null;
      if (input) input.checked = settings[key];
    }
  };

  const initial = await settingsService.load();
  renderValues(initial);

  for (const key of SETTING_KEYS) {
    const input = document.getElementById(key) as HTMLInputElement | null;
    input?.addEventListener('change', () => {
      void settingsService
        .updateSettings({ [key]: input.checked })
        .then(() => showStatus('设置已保存，刷新豆包页面后生效'));
    });
  }

  resetBtn?.addEventListener('click', () => {
    void settingsService.resetSettings().then((defaults) => {
      renderValues(defaults);
      showStatus('已恢复默认设置，刷新豆包页面后生效');
    });
  });
}

void initOptions();
