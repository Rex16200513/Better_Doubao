export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  isExpanded: boolean;
  color: string;
  sortIndex?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationReference {
  conversationId: string;
  title: string;
  url: string;
  addedAt: number;
  lastOpenedAt?: number;
  updatedAt?: number;
  starred?: boolean;
  customTitle?: boolean;
  sortIndex?: number;
}

export interface CorpusItem {
  id: string;
  text: string;
  conversationId: string;
  conversationTitle: string;
  addedAt: number;
  selected?: boolean;
}

export interface TextHighlight {
  id: string;
  conversationId: string;
  messageId?: string;
  messageIndex: number;
  text: string;
  startOffset: number;
  endOffset: number;
  prefix: string;
  suffix: string;
  color: string;
  createdAt: number;
}

export interface FolderData {
  folders: Folder[];
  folderContents: Record<string, ConversationReference[]>;
  starredMessages: Record<string, number[]>;
  corpusBoard: CorpusItem[];
  textHighlights?: TextHighlight[];
  sectionCollapsed?: boolean;
}

export interface DragData {
  type: 'conversation' | 'folder';
  conversationId?: string;
  folderId?: string;
  title: string;
  url?: string;
  conversations?: ConversationReference[];
  sourceFolderId?: string;
}

export const FOLDER_COLORS = [
  { id: 'red', name: '红色', value: '#ef4444' },
  { id: 'orange', name: '橙色', value: '#f97316' },
  { id: 'yellow', name: '黄色', value: '#eab308' },
  { id: 'green', name: '绿色', value: '#22c55e' },
  { id: 'blue', name: '蓝色', value: '#3b82f6' },
  { id: 'purple', name: '紫色', value: '#a855f7' },
  { id: 'pink', name: '粉色', value: '#ec4899' },
  { id: 'gray', name: '灰色', value: '#6b7280' },
] as const;

export type FolderColorId = typeof FOLDER_COLORS[number]['id'];

export function getFolderColor(colorId: string): string {
  if (colorId && colorId.startsWith('#')) {
    return colorId;
  }
  const color = FOLDER_COLORS.find(c => c.id === colorId);
  return color?.value ?? FOLDER_COLORS[7].value;
}
