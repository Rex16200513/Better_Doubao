/// <reference types="chrome" />
console.log('[Better Doubao] Background service worker started');

const browser = chrome;

browser.runtime.onInstalled.addListener(() => {
  console.log('[Better Doubao] Extension installed');
});

browser.runtime.onMessage.addListener((message: { type: string; accountId?: string }, _sender: unknown, sendResponse: (response: unknown) => void) => {
  if (message.type === 'GET_FOLDER_DATA') {
    if (message.accountId) {
      const key = `dvFolderData_${message.accountId}`;
      browser.storage.local.get(key).then((result: unknown) => {
        sendResponse(result);
      });
    } else {
      browser.storage.local.get(null).then((all: Record<string, unknown>) => {
        const folderEntries: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(all)) {
          if (key.startsWith('dvFolderData_')) {
            folderEntries[key] = value;
          }
        }
        sendResponse(folderEntries);
      });
    }
    return true;
  }
  return false;
});