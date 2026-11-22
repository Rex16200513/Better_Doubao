import browser from 'webextension-polyfill';
import {
  DEFAULT_PINNED_SKILLS,
  DEFAULT_SETTINGS,
  THEME_PRESETS,
  type CustomQuickButton,
  type ExtensionSettings,
  type ThemePreset,
} from '../types/settings';

const SETTINGS_KEY = 'dbxSettings';

type SettingsListener = (settings: ExtensionSettings) => void;

const BOOLEAN_KEYS = [
  'enableSidebarLauncher',
  'enableFolders',
  'enableCorpusAndHighlight',
  'enableExport',
  'enableLatexDownloader',
  'hideDownloadPromo',
  'hideSidebarFooter',
  'compactInputToolbar',
] as const;

const VALID_THEMES = new Set<string>(THEME_PRESETS.map(t => t.id));

function sanitizeTheme(value: unknown): ThemePreset {
  return typeof value === 'string' && VALID_THEMES.has(value) ? (value as ThemePreset) : 'default';
}

function sanitizePinnedSkills(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_PINNED_SKILLS];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length <= 40)
    )
  );
}

function sanitizeCustomButtons(value: unknown): CustomQuickButton[] {
  if (!Array.isArray(value)) return [];
  const result: CustomQuickButton[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (
      typeof obj.id === 'string' &&
      typeof obj.label === 'string' &&
      typeof obj.prompt === 'string'
    ) {
      const label = obj.label.trim().slice(0, 24);
      const prompt = obj.prompt.trim().slice(0, 2000);
      if (label && prompt) {
        result.push({ id: obj.id.slice(0, 80), label, prompt });
      }
    }
    if (result.length >= 20) break;
  }
  return result;
}

export function mergeSettings(raw: unknown): ExtensionSettings {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_SETTINGS,
      pinnedComposerSkills: [...DEFAULT_PINNED_SKILLS],
      customQuickButtons: [],
    };
  }
  const input = raw as Record<string, unknown>;
  const merged: ExtensionSettings = {
    ...DEFAULT_SETTINGS,
    pinnedComposerSkills: sanitizePinnedSkills(input.pinnedComposerSkills),
    customQuickButtons: sanitizeCustomButtons(input.customQuickButtons),
    themePreset: sanitizeTheme(input.themePreset),
  };
  for (const key of BOOLEAN_KEYS) {
    if (typeof input[key] === 'boolean') {
      merged[key] = input[key] as boolean;
    }
  }
  return merged;
}

export class SettingsService {
  private settings: ExtensionSettings = mergeSettings(null);
  private loaded: Promise<ExtensionSettings> | null = null;
  private listeners = new Set<SettingsListener>();

  load(): Promise<ExtensionSettings> {
    if (!this.loaded) {
      this.loaded = this.readFromStorage();
    }
    return this.loaded;
  }

  private async readFromStorage(): Promise<ExtensionSettings> {
    try {
      const stored = await browser.storage.local.get(SETTINGS_KEY);
      this.settings = mergeSettings(stored[SETTINGS_KEY]);
    } catch {
      this.settings = mergeSettings(null);
    }
    return this.getSettings();
  }

  getSettings(): ExtensionSettings {
    return {
      ...this.settings,
      pinnedComposerSkills: [...this.settings.pinnedComposerSkills],
      customQuickButtons: this.settings.customQuickButtons.map(b => ({ ...b })),
    };
  }

  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSettings();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[SettingsService] Listener error:', error);
      }
    }
  }

  async updateSettings(partial: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
    this.settings = mergeSettings({ ...this.settings, ...partial });
    await browser.storage.local.set({ [SETTINGS_KEY]: this.settings });
    this.notify();
    return this.getSettings();
  }

  async resetSettings(): Promise<ExtensionSettings> {
    this.settings = mergeSettings(null);
    await browser.storage.local.set({ [SETTINGS_KEY]: this.settings });
    this.notify();
    return this.getSettings();
  }
}

export const settingsService = new SettingsService();
