import { sidebarLauncher } from '../../features/sidebar/SidebarLauncher';
import { quickLocator } from '../../features/quicklocator/QuickLocator';
import { corpusBoard } from '../../features/corpusboard/CorpusBoard';
import { exportManager } from '../../features/export/ExportManager';
import { latexDownloader } from '../../features/latex/LatexDownloader';
import { storageService } from '../../core/services/StorageService';
import { settingsService } from '../../core/services/SettingsService';
import { toolHub } from '../../features/tools/ToolHub';

function initFeatures() {
  const settings = settingsService.getSettings();
  if (settings.enableSidebarLauncher) sidebarLauncher.init();
  if (settings.enableQuickLocator) quickLocator.init();
  if (settings.enableCorpusAndHighlight) {
    corpusBoard.init();
    toolHub.init();
  }
  if (settings.enableExport) exportManager.init();
  if (settings.enableLatexDownloader) latexDownloader.init();
}

async function main() {
  await Promise.all([storageService.init(), settingsService.load()]);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFeatures);
  } else {
    initFeatures();
  }
}

main();
