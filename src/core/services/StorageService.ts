import browser from 'webextension-polyfill';
import type { FolderData, Folder, CorpusItem, TextHighlight, ConversationReference } from '../types/folder';

const STORAGE_KEY = 'dvFolderData';
const BACKUP_KEY = 'dvFolderBackup';
const ACCOUNT_KEY = 'dvAccountId';

function getCurrentAccountId(): string {
  try {
    const keys = ['token', 'auth_token', 'accessToken', 'userInfo', 'user_id', 'accountId'];
    for (const key of keys) {
      const value = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (parsed.id) return `user_${parsed.id}`;
          if (parsed.userId) return `user_${parsed.userId}`;
          if (parsed.sub) return `user_${parsed.sub}`;
        } catch {
          if (value.length > 10 && value.length < 200) {
            return `token_${key}_${value.substring(0, 50)}`;
          }
        }
      }
    }
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name && value && value.length > 10 && value.length < 200) {
        if (name.includes('slardar') || name.includes('session') || name.includes('timestamp')) {
          continue;
        }
        return `cookie_${name}_${value.substring(0, 30)}`;
      }
    }
  } catch (e) {
    console.warn('[Storage] Failed to get account ID:', e);
  }
  return 'default';
}

function validateFolderData(data: unknown): data is FolderData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.folders) &&
    typeof d.folderContents === 'object' &&
    typeof d.starredMessages === 'object' &&
    Array.isArray(d.corpusBoard) &&
    (d.textHighlights === undefined || Array.isArray(d.textHighlights));
}

export class StorageService {
  validateBackup(value: unknown): FolderData {
    const fail = (): never => { throw new Error('备份格式或数据字段无效'); };
    if (!value || typeof value !== 'object') return fail();
    const envelope = value as Record<string, unknown>;
    if (envelope.format !== 'better-doubao-backup' || envelope.version !== 1) return fail();
    const data = envelope.data as FolderData;
    if (!validateFolderData(data)) return fail();
    const safeString = (v: unknown): v is string => typeof v === 'string' && v.length <= 1000000;
    const id = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,200}$/.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v);
    const number = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 0;
    const color = (v: unknown): boolean => typeof v === 'string' && /^(#[\da-fA-F]{3}|#[\da-fA-F]{6}|red|orange|yellow|green|blue|purple|pink|gray)$/.test(v);
    if (!data.folderContents || !data.starredMessages) return fail();
    for (const f of data.folders) {
      if (!f || !id(f.id) || !safeString(f.name) || f.name.length > 200 || !color(f.color) || typeof f.isExpanded !== 'boolean' || !number(f.createdAt) || !number(f.updatedAt)) return fail();
    }
    for (const [key, entries] of Object.entries(data.folderContents)) {
      if (!id(key) || !Array.isArray(entries)) return fail();
      for (const c of entries) if (!c || !id(c.conversationId) || !safeString(c.title) || !safeString(c.url) || !number(c.addedAt)) return fail();
    }
    for (const [key, entries] of Object.entries(data.starredMessages)) if (!id(key) || !Array.isArray(entries) || !entries.every(n => Number.isSafeInteger(n) && n >= 0)) return fail();
    for (const c of data.corpusBoard) if (!c || !id(c.id) || !id(c.conversationId) || !safeString(c.text) || !safeString(c.conversationTitle) || !number(c.addedAt)) return fail();
    for (const h of data.textHighlights ?? []) if (!h || !id(h.id) || !id(h.conversationId) || !safeString(h.text) || !safeString(h.prefix) || !safeString(h.suffix) || !color(h.color) || !number(h.startOffset) || !number(h.endOffset) || !number(h.messageIndex) || !number(h.createdAt)) return fail();
    return JSON.parse(JSON.stringify(data)) as FolderData;
  }

  async restoreBackup(value: unknown): Promise<void> {
    const next = this.validateBackup(value);
    await this.save();
    await browser.storage.local.set({ [`dvBeforeRestore_${this.currentAccountId}`]: this.data, [this.getStorageKey()]: next, [`${BACKUP_KEY}_${this.currentAccountId}`]: next });
    this.data = next;
  }

  async undoRestore(): Promise<void> {
    const key = `dvBeforeRestore_${this.currentAccountId}`;
    const stored = await browser.storage.local.get(key);
    const previous = stored[key];
    if (!validateFolderData(previous)) throw new Error('暂无恢复前副本');
    await this.restoreBackup({ format: 'better-doubao-backup', version: 1, data: previous });
  }
  private data: FolderData = { folders: [], folderContents: {}, starredMessages: {}, corpusBoard: [], textHighlights: [], sectionCollapsed: false };
  private saveTimer: number | null = null;
  private currentAccountId: string = '';
  private initialization: Promise<void> | null = null;

  private getStorageKey(): string {
    return `${STORAGE_KEY}_${this.currentAccountId}`;
  }

  init(): Promise<void> {
    // Both the content entrypoint and FolderManager initialize this singleton.
    if (!this.initialization) this.initialization = this.load();
    return this.initialization;
  }

  private async load(): Promise<void> {
    this.currentAccountId = getCurrentAccountId();
    const key = this.getStorageKey();
    const backupKey = `${BACKUP_KEY}_${this.currentAccountId}`;
    const stored = await browser.storage.local.get([key, backupKey]);
    const saved = stored[key] ?? stored[backupKey];
    if (validateFolderData(saved)) {
      this.data = { ...saved, textHighlights: saved.textHighlights ?? [] };
    }
    // Legacy page backups are untrusted: never import page-controlled objects.
    // Primary extension records remain intact; remove exposed duplicate copies.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const legacyKey = localStorage.key(i);
        if (legacyKey?.startsWith(`${BACKUP_KEY}_`)) localStorage.removeItem(legacyKey);
      }
      localStorage.removeItem(ACCOUNT_KEY);
    } catch (error) {
      console.warn('[Storage] Legacy backup cleanup failed:', error);
    }
  }

  private async persist(): Promise<void> {
    try {
      await browser.storage.local.set({
        [this.getStorageKey()]: this.data,
        [`${BACKUP_KEY}_${this.currentAccountId}`]: this.data,
      });
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

  async getSectionCollapsed(): Promise<boolean> {
    return this.data.sectionCollapsed ?? false;
  }

  setSectionCollapsed(collapsed: boolean): void {
    this.data.sectionCollapsed = collapsed;
    this.debouncedSave();
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

  async moveConversationBetweenFolders(
    fromFolderId: string,
    toFolderId: string,
    conversation: ConversationReference
  ): Promise<void> {
    if (fromFolderId === toFolderId) return;

    const sourceContents = this.data.folderContents[fromFolderId];
    if (!sourceContents) return;

    const existingIndex = sourceContents.findIndex(c => c.conversationId === conversation.conversationId);
    if (existingIndex === -1) return;

    const existingConversation = sourceContents[existingIndex];
    sourceContents.splice(existingIndex, 1);

    if (!this.data.folderContents[toFolderId]) {
      this.data.folderContents[toFolderId] = [];
    }
    const alreadyExists = this.data.folderContents[toFolderId].some(
      c => c.conversationId === conversation.conversationId
    );
    if (!alreadyExists) {
      this.data.folderContents[toFolderId].push({
        ...existingConversation,
        ...conversation,
        addedAt: existingConversation.addedAt,
      });
    }

    this.debouncedSave();
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

  async getTextHighlights(conversationId: string): Promise<TextHighlight[]> {
    return (this.data.textHighlights ?? []).filter(
      item => item.conversationId === conversationId
    );
  }

  async addTextHighlight(
    highlight: Omit<TextHighlight, 'id' | 'createdAt'>
  ): Promise<TextHighlight> {
    const item: TextHighlight = {
      ...highlight,
      id: `highlight_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    };

    if (!this.data.textHighlights) {
      this.data.textHighlights = [];
    }

    this.data.textHighlights.push(item);
    this.debouncedSave();
    return item;
  }

  async updateTextHighlightColor(id: string, color: string): Promise<void> {
    const item = this.data.textHighlights?.find(highlight => highlight.id === id);
    if (item) {
      item.color = color;
      this.debouncedSave();
    }
  }

  async removeTextHighlight(id: string): Promise<void> {
    this.data.textHighlights = (this.data.textHighlights ?? []).filter(
      item => item.id !== id
    );
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
