/// <reference types="chrome" />
console.log('[Better Doubao] Background service worker started');

const browser = chrome;

browser.runtime.onInstalled.addListener(() => {
  console.log('[Better Doubao] Extension installed');
});

browser.runtime.onMessage.addListener((message: { type: string }, _sender: unknown, sendResponse: (response: unknown) => void) => {
  if (message.type === 'GET_FOLDER_DATA') {
    browser.storage.local.get('dvFolderData').then((result: unknown) => {
      sendResponse(result);
    });
    return true;
  }
  return false;
});