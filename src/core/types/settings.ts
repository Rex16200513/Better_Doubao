export interface ExtensionSettings {
  enableSidebarLauncher: boolean;
  enableQuickLocator: boolean;
  autoIndexLongChat: boolean;
  enableFolderManager: boolean;
  enableCorpusAndHighlight: boolean;
  enableExport: boolean;
  enableLatexDownloader: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enableSidebarLauncher: true,
  enableQuickLocator: true,
  autoIndexLongChat: true,
  enableFolderManager: true,
  enableCorpusAndHighlight: true,
  enableExport: true,
  enableLatexDownloader: true,
};
