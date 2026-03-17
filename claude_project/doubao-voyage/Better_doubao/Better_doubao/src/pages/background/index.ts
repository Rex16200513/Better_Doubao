console.log('[Better Doubao] Background service worker started');

const browser = globalThis.chrome;

browser.runtime.onInstalled.addListener(() => {
  console.log('[Better Doubao] Extension installed');
});

browser.runtime.onMessage.addListener((message: { type: string }, sender: unknown, sendResponse: (response: unknown) => void) => {
  if (message.type === 'GET_FOLDER_DATA') {
    browser.storage.local.get('dvFolderData').then((result: unknown) => {
      sendResponse(result);
    });
    return true;
  }
});
