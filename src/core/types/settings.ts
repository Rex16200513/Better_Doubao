export interface ExtensionSettings {
  enableSidebarLauncher: boolean;
  enableNativeLocatorEnhancer: boolean;
  enableCorpusAndHighlight: boolean;
  enableExport: boolean;
  enableLatexDownloader: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enableSidebarLauncher: true,
  enableNativeLocatorEnhancer: true,
  enableCorpusAndHighlight: true,
  enableExport: true,
  enableLatexDownloader: true,
};
