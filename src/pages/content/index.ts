import { folderManager } from '../../features/folder/FolderManager';
import { sidebarLauncher } from '../../features/sidebar/SidebarLauncher';
import { quickLocator } from '../../features/quicklocator/QuickLocator';
import { corpusBoard } from '../../features/corpusboard/CorpusBoard';
import { exportManager } from '../../features/export/ExportManager';
import { latexDownloader } from '../../features/latex/LatexDownloader';
import { storageService } from '../../core/services/StorageService';
import { toolHub } from '../../features/tools/ToolHub';

async function main() {
  await storageService.init();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      folderManager.init();
      sidebarLauncher.init();
      quickLocator.init();
      corpusBoard.init();
      toolHub.init();
      exportManager.init();
      latexDownloader.init();
    });
  } else {
    folderManager.init();
    sidebarLauncher.init();
    quickLocator.init();
    corpusBoard.init();
    toolHub.init();
    exportManager.init();
    latexDownloader.init();
  }
}

main();
