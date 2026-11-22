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
  compactInputToolbar: boolean;
  pinnedComposerSkills: string[];
  customQuickButtons: CustomQuickButton[];
}

export const DEFAULT_PINNED_SKILLS: string[] = ['对话', '更多技能'];

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enableSidebarLauncher: true,
  enableNativeLocatorEnhancer: true,
  enableCorpusAndHighlight: true,
  enableExport: true,
  enableLatexDownloader: true,
  hideDownloadPromo: true,
  compactInputToolbar: true,
  pinnedComposerSkills: [...DEFAULT_PINNED_SKILLS],
  customQuickButtons: [],
};
