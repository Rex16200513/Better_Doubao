export interface ExtensionSettings {
  enableSidebarLauncher: boolean;
  enableQuickLocator: boolean;
  autoIndexLongChat: boolean;
  enableCorpusAndHighlight: boolean;
  enableExport: boolean;
  enableLatexDownloader: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enableSidebarLauncher: true,
  enableQuickLocator: true,
  autoIndexLongChat: true,
  enableCorpusAndHighlight: true,
  enableExport: true,
  enableLatexDownloader: true,
};
