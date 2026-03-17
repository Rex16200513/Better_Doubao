import browser from 'webextension-polyfill';
import type { FolderData, Folder, CorpusItem } from '../types/folder';

const STORAGE_KEY = 'dvFolderData';
const BACKUP_KEY = 'dvFolderBackup';

function validateFolderData(data: unknown): data is FolderData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.folders) && typeof d.folderContents === 'object' && typeof d.starredMessages === 'object' && Array.isArray(d.corpusBoard);
}

function createBackup(data: FolderData): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.warn('[Storage] Backup failed:', e);
  }
}

function restoreFromBackup(): FolderData | null {
  try {
    const stored = localStorage.getItem(BACKUP_KEY);
    if (stored) {
      const backup = JSON.parse(stored);
      if (backup.data && validateFolderData(backup.data)) {
        return backup.data as FolderData;
      }
    }
  } catch (e) {
    console.warn('[Storage] Restore from backup failed:', e);
  }
  return null;
}

export class StorageService {
  private data: FolderData = { folders: [], folderContents: {}, starredMessages: {}, corpusBoard: [] };
  private saveTimer: number | null = null;

  async init(): Promise<void> {
    try {
      const stored = await browser.storage.local.get(STORAGE_KEY);
      if (stored[STORAGE_KEY] && validateFolderData(stored[STORAGE_KEY])) {
        this.data = stored[STORAGE_KEY] as FolderData;
        console.log('[Storage] Loaded from chrome.storage');
      } else {
        const backup = restoreFromBackup();
        if (backup) {
          this.data = backup;
          await this.persist();
          console.log('[Storage] Restored from localStorage backup');
        }
      }
    } catch (error) {
      console.error('[Storage] Init error:', error);
      const backup = restoreFromBackup();
      if (backup) {
        this.data = backup;
      }
    }
  }

  private async persist(): Promise<void> {
    createBackup(this.data);
    try {
      await browser.storage.local.set({ [STORAGE_KEY]: this.data });
    } catch (error) {
      console.error('[Storage] Save failed:', error);
    }
  }

  private debouncedSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      this.persist();
      this.saveTimer = null;
    }, 300);
  }

  async getData(): Promise<FolderData> {
    return this.data;
  }

  async saveFolders(folders: Folder[]): Promise<void> {
    this.data.folders = folders;
    this.debouncedSave();
  }

  async getFolders(): Promise<Folder[]> {
    return this.data.folders;
  }

  async addFolder(folder: Folder): Promise<void> {
    this.data.folders.push(folder);
    this.data.folderContents[folder.id] = [];
    this.debouncedSave();
  }

  async updateFolder(folderId: string, updates: Partial<Folder>): Promise<void> {
    const index = this.data.folders.findIndex(f => f.id === folderId);
    if (index !== -1) {
      this.data.folders[index] = { ...this.data.folders[index], ...updates, updatedAt: Date.now() };
      this.debouncedSave();
    }
  }

  async deleteFolder(folderId: string): Promise<void> {
    this.data.folders = this.data.folders.filter(f => f.id !== folderId);
    delete this.data.folderContents[folderId];
    this.debouncedSave();
  }

  async addConversationToFolder(folderId: string, conversation: { conversationId: string; title: string; url: string; addedAt: number }): Promise<void> {
    if (!this.data.folderContents[folderId]) {
      this.data.folderContents[folderId] = [];
    }
    const exists = this.data.folderContents[folderId].some(c => c.conversationId === conversation.conversationId);
    if (!exists) {
      this.data.folderContents[folderId].push(conversation as any);
      this.debouncedSave();
    }
  }

  async removeConversationFromFolder(folderId: string, conversationId: string): Promise<void> {
    if (this.data.folderContents[folderId]) {
      this.data.folderContents[folderId] = this.data.folderContents[folderId].filter(
        c => c.conversationId !== conversationId
      );
      this.debouncedSave();
    }
  }

  async getConversationFolders(conversationId: string): Promise<string[]> {
    const folders: string[] = [];
    for (const [folderId, contents] of Object.entries(this.data.folderContents)) {
      if (contents.some(c => c.conversationId === conversationId)) {
        folders.push(folderId);
      }
    }
    return folders;
  }

  async getFolderContents(folderId: string): Promise<any[]> {
    return this.data.folderContents[folderId] ?? [];
  }

  async getStarredMessages(conversationId: string): Promise<number[]> {
    return this.data.starredMessages[conversationId] ?? [];
  }

  async addStarredMessage(conversationId: string, messageIndex: number): Promise<void> {
    if (!this.data.starredMessages[conversationId]) {
      this.data.starredMessages[conversationId] = [];
    }
    if (!this.data.starredMessages[conversationId].includes(messageIndex)) {
      this.data.starredMessages[conversationId].push(messageIndex);
      this.debouncedSave();
    }
  }

  async removeStarredMessage(conversationId: string, messageIndex: number): Promise<void> {
    if (this.data.starredMessages[conversationId]) {
      const index = this.data.starredMessages[conversationId].indexOf(messageIndex);
      if (index > -1) {
        this.data.starredMessages[conversationId].splice(index, 1);
        this.debouncedSave();
      }
    }
  }

  async toggleStarredMessage(conversationId: string, messageIndex: number): Promise<boolean> {
    const isStarred = await this.isMessageStarred(conversationId, messageIndex);
    if (isStarred) {
      await this.removeStarredMessage(conversationId, messageIndex);
      return false;
    } else {
      await this.addStarredMessage(conversationId, messageIndex);
      return true;
    }
  }

  async isMessageStarred(conversationId: string, messageIndex: number): Promise<boolean> {
    const starred = this.data.starredMessages[conversationId] ?? [];
    return starred.includes(messageIndex);
  }

  async getCorpusBoard(): Promise<CorpusItem[]> {
    return this.data.corpusBoard;
  }

  async addToCorpusBoard(text: string, conversationId: string, conversationTitle: string): Promise<CorpusItem> {
    const item: CorpusItem = {
      id: `corpus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      conversationId,
      conversationTitle,
      addedAt: Date.now(),
    };
    this.data.corpusBoard.push(item);
    this.debouncedSave();
    return item;
  }

  async removeFromCorpusBoard(itemId: string): Promise<void> {
    this.data.corpusBoard = this.data.corpusBoard.filter(item => item.id !== itemId);
    this.debouncedSave();
  }

  async clearCorpusBoard(): Promise<void> {
    this.data.corpusBoard = [];
    this.debouncedSave();
  }

  async save(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.persist();
  }
}

export const storageService = new StorageService();
