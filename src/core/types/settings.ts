export type ThemePreset = 'default' | 'indigo' | 'emerald' | 'warm' | 'violet' | 'midnight';

export interface CustomQuickButton {
  id: string;
  label: string;
  prompt: string;
}

export interface ExtensionSettings {
  enableSidebarLauncher: boolean;
  enableNativeLocatorEnhancer: boolean;
  enableCorpusAndHighlight: boolean;
  enableExport: boolean;
  enableLatexDownloader: boolean;
  hideDownloadPromo: boolean;
  hideSidebarFooter: boolean;
  compactInputToolbar: boolean;
  pinnedComposerSkills: string[];
  customQuickButtons: CustomQuickButton[];
  themePreset: ThemePreset;
}

export const THEME_PRESETS: ReadonlyArray<{
  id: ThemePreset;
  name: string;
  bg: string;
  accent: string;
  dark?: boolean;
}> = [
  { id: 'default', name: '默认纯净', bg: '#ffffff', accent: '#4f46e5' },
  { id: 'indigo', name: '靛蓝极客', bg: '#f6f8ff', accent: '#4f46e5' },
  { id: 'emerald', name: '翡翠森系', bg: '#f4faf7', accent: '#059669' },
  { id: 'warm', name: '暖纸护眼', bg: '#faf6ee', accent: '#d97706' },
  { id: 'violet', name: '暮光微紫', bg: '#f8f5ff', accent: '#7c3aed' },
  { id: 'midnight', name: '深邃暗夜', bg: '#161922', accent: '#818cf8', dark: true },
];

export const DEFAULT_PINNED_SKILLS: string[] = ['对话', '更多技能'];

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enableSidebarLauncher: true,
  enableNativeLocatorEnhancer: true,
  enableCorpusAndHighlight: true,
  enableExport: true,
  enableLatexDownloader: true,
  hideDownloadPromo: true,
  hideSidebarFooter: true,
  compactInputToolbar: true,
  pinnedComposerSkills: [...DEFAULT_PINNED_SKILLS],
  customQuickButtons: [],
  themePreset: 'default',
};
