import browser from 'webextension-polyfill';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '../types/settings';

const SETTINGS_KEY = 'dbxSettings';

export function mergeSettings(raw: unknown): ExtensionSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }
  const input = raw as Record<string, unknown>;
  const merged: ExtensionSettings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof ExtensionSettings>) {
    if (typeof input[key] === 'boolean') {
      merged[key] = input[key] as boolean;
    }
  }
  return merged;
}

export class SettingsService {
  private settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
  private loaded: Promise<ExtensionSettings> | null = null;

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
      this.settings = { ...DEFAULT_SETTINGS };
    }
    return { ...this.settings };
  }

  getSettings(): ExtensionSettings {
    return { ...this.settings };
  }

  async updateSettings(partial: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
    this.settings = mergeSettings({ ...this.settings, ...partial });
    await browser.storage.local.set({ [SETTINGS_KEY]: this.settings });
    return { ...this.settings };
  }

  async resetSettings(): Promise<ExtensionSettings> {
    this.settings = { ...DEFAULT_SETTINGS };
    await browser.storage.local.set({ [SETTINGS_KEY]: this.settings });
    return { ...this.settings };
  }
}

export const settingsService = new SettingsService();
