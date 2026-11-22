import { storageService } from '../../core/services/StorageService';
import { getConversationId } from '../../core/utils/dom';
import type { TextHighlight } from '../../core/types/folder';

export class TextHighlighter {
  private isRestoring = false;

  async applyHighlight(selectionRange: Range, color: string): Promise<boolean> {
    if (selectionRange.collapsed) return false;

    const range = selectionRange.cloneRange();
    const root = this.findHighlightMessageRoot(range.startContainer);
    const highlightData = this.createTextHighlightAnchor(range, color);
    if (!root || !highlightData || !root.contains(range.endContainer)) {
      return false;
    }

    await this.removeSelectedHighlightPortions(range.cloneRange());

    const cleanRange = this.createRangeFromTextOffsets(
      root,
      highlightData.startOffset,
      highlightData.endOffset
    );
    if (!cleanRange || cleanRange.toString() !== highlightData.text) {
      return false;
    }

    const marks = this.wrapRangeWithHighlight(cleanRange, color);
    if (marks.length === 0) return false;

    const item = await storageService.addTextHighlight(highlightData);
    marks.forEach((mark) => {
      mark.dataset.dbxHighlightId = item.id;
      mark.dataset.dbxConversationId = item.conversationId;
    });
    await storageService.save();
    return true;
  }

  async restoreTextHighlights(): Promise<void> {
    if (this.isRestoring) return;

    const conversationId = getConversationId();
    if (conversationId === 'unknown') return;

    this.isRestoring = true;
    try {
      const highlights = await storageService.getTextHighlights(conversationId);

      for (const highlight of highlights) {
        const alreadyRendered = Array.from(
          document.querySelectorAll<HTMLElement>('.dbx-text-highlight')
        ).some(mark => mark.dataset.dbxHighlightId === highlight.id);

        if (alreadyRendered) continue;

        const root = this.findRootForSavedHighlight(highlight);
        if (!root) continue;

        const startOffset = this.findSavedHighlightOffset(root, highlight);
        if (startOffset === null) continue;

        const range = this.createRangeFromTextOffsets(
          root,
          startOffset,
          startOffset + highlight.text.length
        );
        if (!range || range.toString() !== highlight.text) continue;

        const marks = this.wrapRangeWithHighlight(range, highlight.color);
        if (marks.length === 0) continue;

        marks.forEach((mark) => {
          mark.dataset.dbxHighlightId = highlight.id;
          mark.dataset.dbxConversationId = highlight.conversationId;
        });
      }
    } catch (error) {
      console.error('[TextHighlighter] Failed to restore text highlights:', error);
    } finally {
      this.isRestoring = false;
    }
  }

  createTextHighlightAnchor(
    range: Range,
    color: string
  ): Omit<TextHighlight, 'id' | 'createdAt'> | null {
    const root = this.findHighlightMessageRoot(range.startContainer);
    if (!root || !root.contains(range.endContainer)) return null;

    const text = range.toString();
    if (!text) return null;

    try {
      const beforeRange = range.cloneRange();
      beforeRange.selectNodeContents(root);
      beforeRange.setEnd(range.startContainer, range.startOffset);

      const startOffset = beforeRange.toString().length;
      const endOffset = startOffset + text.length;
      const rootText = root.textContent ?? '';
      const roots = this.getHighlightMessageRoots();
      const messageIndex = Math.max(0, roots.indexOf(root));

      return {
        conversationId: getConversationId(),
        messageId: this.getHighlightMessageId(root),
        messageIndex,
        text,
        startOffset,
        endOffset,
        prefix: rootText.slice(Math.max(0, startOffset - 48), startOffset),
        suffix: rootText.slice(endOffset, endOffset + 48),
        color,
      };
    } catch (error) {
      console.error('[TextHighlighter] Failed to capture highlight position:', error);
      return null;
    }
  }

  findHighlightMessageRoot(node: Node): HTMLElement | null {
    const element = node.nodeType === Node.ELEMENT_NODE
      ? node as Element
      : node.parentElement;
    if (!element) return null;

    const contentRoot = element.closest<HTMLElement>(
      '.flow-markdown-body, [data-testid="message_content"], [data-testid="message_text"]'
    );
    if (contentRoot) return contentRoot;

    const messageContainer = element.closest<HTMLElement>(
      '[data-message-id], [data-testid="union_message"], [data-testid="message-block-container"], [class*="message-block"]'
    );
    if (!messageContainer) return null;

    return messageContainer.querySelector<HTMLElement>(
      '.flow-markdown-body, [data-testid="message_content"], [data-testid="message_text"]'
    ) ?? messageContainer;
  }

  getHighlightMessageRoots(): HTMLElement[] {
    const roots: HTMLElement[] = [];
    const addRoot = (root: HTMLElement): void => {
      if (root.closest('.dbx-corpus-selection-btn, .dbx-corpus-panel')) return;
      if (!roots.includes(root)) {
        roots.push(root);
      }
    };

    document.querySelectorAll<HTMLElement>(
      '[data-message-id], [data-testid="union_message"], [data-testid="message-block-container"]'
    ).forEach((container) => {
      const blocks = container.querySelectorAll<HTMLElement>(
        '.flow-markdown-body, [data-testid="message_content"], [data-testid="message_text"]'
      );
      if (blocks.length > 0) {
        blocks.forEach(addRoot);
      } else {
        addRoot(container);
      }
    });

    document.querySelectorAll<HTMLElement>(
      '.flow-markdown-body, [data-testid="message_content"], [data-testid="message_text"]'
    ).forEach(addRoot);

    return roots;
  }

  getHighlightMessageId(root: HTMLElement): string | undefined {
    const messageContainer = root.closest<HTMLElement>(
      '[data-testid="union_message"], [data-testid="message-block-container"], [class*="message-block"]'
    );
    const messageElement = root.closest<HTMLElement>('[data-message-id]') ??
      root.querySelector<HTMLElement>('[data-message-id]') ??
      messageContainer?.querySelector<HTMLElement>('[data-message-id]');
    return messageElement?.getAttribute('data-message-id') ?? undefined;
  }

  findRootForSavedHighlight(highlight: TextHighlight): HTMLElement | null {
    const roots = this.getHighlightMessageRoots();

    // When a highlight is anchored to a specific messageId, strictly scope matching to
    // that message's content blocks (supports multi-block messages and prevents cross-message
    // mis-attachment when the original message is virtual-scroll unloaded).
    if (highlight.messageId) {
      const sameMessageRoots = roots.filter(
        root => this.getHighlightMessageId(root) === highlight.messageId
      );
      if (sameMessageRoots.length === 0) return null;
      return sameMessageRoots.find(
        root => this.findSavedHighlightOffset(root, highlight, false) !== null
      ) ?? null;
    }

    const indexedRoot = roots[highlight.messageIndex];
    if (indexedRoot && this.findSavedHighlightOffset(indexedRoot, highlight, false) !== null) {
      return indexedRoot;
    }

    // Cross-root fallback without messageId requires context confirmation so common short
    // phrases cannot attach to an unrelated message.
    return roots.find(
      root => this.findSavedHighlightOffset(root, highlight, true) !== null
    ) ?? null;
  }

  findSavedHighlightOffset(
    root: HTMLElement,
    highlight: TextHighlight,
    requireContext = false
  ): number | null {
    const rootText = root.textContent ?? '';
    if (!highlight.text || !rootText.includes(highlight.text)) return null;

    const fullContext = `${highlight.prefix}${highlight.text}${highlight.suffix}`;
    if (
      rootText.slice(highlight.startOffset, highlight.endOffset) === highlight.text
    ) {
      if (!requireContext) return highlight.startOffset;
      const prefixOk = !!highlight.prefix &&
        rootText.slice(Math.max(0, highlight.startOffset - highlight.prefix.length), highlight.startOffset)
          .endsWith(highlight.prefix);
      const suffixOk = !!highlight.suffix &&
        rootText.slice(highlight.endOffset, highlight.endOffset + highlight.suffix.length)
          .startsWith(highlight.suffix);
      if (prefixOk || suffixOk || (!highlight.prefix && !highlight.suffix)) {
        return highlight.startOffset;
      }
    }

    const contextIndex = fullContext ? rootText.indexOf(fullContext) : -1;
    if (contextIndex >= 0) {
      return contextIndex + highlight.prefix.length;
    }

    let bestOffset: number | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let searchFrom = 0;

    while (searchFrom <= rootText.length) {
      const offset = rootText.indexOf(highlight.text, searchFrom);
      if (offset < 0) break;

      const prefixMatches = !!highlight.prefix &&
        rootText.slice(Math.max(0, offset - highlight.prefix.length), offset)
          .endsWith(highlight.prefix);
      const suffixMatches = !!highlight.suffix &&
        rootText.slice(
          offset + highlight.text.length,
          offset + highlight.text.length + highlight.suffix.length
        ).startsWith(highlight.suffix);

      if (requireContext && (highlight.prefix || highlight.suffix) && !prefixMatches && !suffixMatches) {
        searchFrom = offset + Math.max(1, highlight.text.length);
        continue;
      }

      const distance = Math.abs(offset - highlight.startOffset);
      const score = (prefixMatches ? 1000 : 0) +
        (suffixMatches ? 1000 : 0) -
        distance;

      if (score > bestScore) {
        bestScore = score;
        bestOffset = offset;
      }

      searchFrom = offset + Math.max(1, highlight.text.length);
    }

    return bestOffset;
  }

  createRangeFromTextOffsets(
    root: HTMLElement,
    startOffset: number,
    endOffset: number
  ): Range | null {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startNode: Text | null = null;
    let endNode: Text | null = null;
    let startInNode = 0;
    let endInNode = 0;
    let lastNonEmptyNode: Text | null = null;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const len = node.data.length;
      const nextOffset = currentOffset + len;
      if (len > 0) lastNonEmptyNode = node;

      // Prefer the start of the next non-empty node when startOffset lands on a boundary.
      if (!startNode && len > 0 && startOffset >= currentOffset && startOffset < nextOffset) {
        startNode = node;
        startInNode = startOffset - currentOffset;
      }

      if (!endNode && len > 0 && endOffset > currentOffset && endOffset <= nextOffset) {
        endNode = node;
        endInNode = endOffset - currentOffset;
      }

      currentOffset = nextOffset;
      if (startNode && endNode) break;
    }

    if (!startNode && lastNonEmptyNode && startOffset === currentOffset) {
      startNode = lastNonEmptyNode;
      startInNode = lastNonEmptyNode.data.length;
    }
    if (!endNode && lastNonEmptyNode && endOffset === currentOffset) {
      endNode = lastNonEmptyNode;
      endInNode = lastNonEmptyNode.data.length;
    }

    if (!startNode || !endNode) return null;

    const range = document.createRange();
    range.setStart(startNode, startInNode);
    range.setEnd(endNode, endInNode);
    return range;
  }

  private getTextPartsInRange(
    range: Range
  ): Array<{ node: Text; startOffset: number; endOffset: number }> {
    const root =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;

    if (!root) return [];

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const parts: Array<{ node: Text; startOffset: number; endOffset: number }> = [];

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;

      try {
        if (!range.intersectsNode(node)) continue;
      } catch {
        continue;
      }

      const startOffset = node === range.startContainer ? range.startOffset : 0;
      const endOffset = node === range.endContainer ? range.endOffset : node.data.length;

      if (endOffset <= startOffset) continue;
      if (!node.data.slice(startOffset, endOffset).trim()) continue;

      parts.push({ node, startOffset, endOffset });
    }

    return parts;
  }

  wrapRangeWithHighlight(
    range: Range,
    color: string
  ): HTMLElement[] {
    try {
      const parts = this.getTextPartsInRange(range);
      const marks: HTMLElement[] = [];

      [...parts].reverse().forEach(({ node, startOffset, endOffset }) => {
        const mark = document.createElement('mark');
        mark.className = 'dbx-text-highlight';
        mark.style.backgroundColor = color;

        const textRange = document.createRange();
        textRange.setStart(node, startOffset);
        textRange.setEnd(node, endOffset);

        const contents = textRange.extractContents();
        mark.appendChild(contents);
        textRange.insertNode(mark);
        marks.unshift(mark);
      });

      return marks;
    } catch (error) {
      console.error('[TextHighlighter] Failed to wrap highlighted text:', error);
      return [];
    }
  }

  unwrapHighlight(mark: HTMLElement): void {
    const parent = mark.parentNode;
    if (!parent) return;

    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }

    mark.remove();
    parent.normalize();
  }

  async removeSelectedHighlightPortions(
    selectionRange: Range
  ): Promise<void> {
    const selectionAnchor = this.createTextHighlightAnchor(selectionRange, '');
    const root = this.findHighlightMessageRoot(selectionRange.startContainer);
    if (!selectionAnchor || !root || !root.contains(selectionRange.endContainer)) {
      return;
    }

    const allMarks = Array.from(
      root.querySelectorAll<HTMLElement>('.dbx-text-highlight')
    );
    const directlySelectedMarks = allMarks.filter((mark) => {
      try {
        return selectionRange.intersectsNode(mark);
      } catch {
        return false;
      }
    });

    if (directlySelectedMarks.length === 0) return;

    try {
      const savedHighlights = await storageService.getTextHighlights(
        selectionAnchor.conversationId
      );
      const highlightsById = new Map(
        savedHighlights.map(highlight => [highlight.id, highlight])
      );
      const remainingSegments: Array<{
        startOffset: number;
        endOffset: number;
        color: string;
      }> = [];
      const removedIds = new Set<string>();
      const marksToUnwrap = new Set<HTMLElement>();

      const getLiveOffsetsForHighlight = (
        highlightId: string,
        fallbackStart: number,
        fallbackEnd: number
      ): { startOffset: number; endOffset: number } => {
        const marksForId = allMarks.filter(m => m.dataset.dbxHighlightId === highlightId);
        if (marksForId.length === 0) {
          return { startOffset: fallbackStart, endOffset: fallbackEnd };
        }
        try {
          const first = marksForId[0];
          const last = marksForId[marksForId.length - 1];
          const beforeFirst = document.createRange();
          beforeFirst.selectNodeContents(root);
          beforeFirst.setEndBefore(first);
          const beforeAfterLast = document.createRange();
          beforeAfterLast.selectNodeContents(root);
          beforeAfterLast.setEndAfter(last);
          const liveStart = beforeFirst.toString().length;
          const liveEnd = beforeAfterLast.toString().length;
          if (liveEnd > liveStart) {
            return { startOffset: liveStart, endOffset: liveEnd };
          }
        } catch {
          // Fall back to stored offsets if range construction fails.
        }
        return { startOffset: fallbackStart, endOffset: fallbackEnd };
      };

      directlySelectedMarks.forEach((mark) => {
        const id = mark.dataset.dbxHighlightId;
        const highlight = id ? highlightsById.get(id) : undefined;

        if (!id || !highlight) {
          marksToUnwrap.add(mark);
          return;
        }

        if (removedIds.has(id)) return;

        const { startOffset: liveStart, endOffset: liveEnd } = getLiveOffsetsForHighlight(
          id,
          highlight.startOffset,
          highlight.endOffset
        );

        const overlapStart = Math.max(liveStart, selectionAnchor.startOffset);
        const overlapEnd = Math.min(liveEnd, selectionAnchor.endOffset);

        if (overlapStart >= overlapEnd) return;

        if (liveStart < overlapStart) {
          remainingSegments.push({
            startOffset: liveStart,
            endOffset: overlapStart,
            color: highlight.color,
          });
        }

        if (overlapEnd < liveEnd) {
          remainingSegments.push({
            startOffset: overlapEnd,
            endOffset: liveEnd,
            color: highlight.color,
          });
        }

        removedIds.add(id);
      });

      allMarks.forEach((mark) => {
        const id = mark.dataset.dbxHighlightId;
        if (id && removedIds.has(id)) {
          marksToUnwrap.add(mark);
        }
      });

      marksToUnwrap.forEach(mark => this.unwrapHighlight(mark));

      await Promise.all(
        Array.from(removedIds).map(id => storageService.removeTextHighlight(id))
      );

      remainingSegments.sort(
        (a, b) => a.startOffset - b.startOffset
      );

      for (const segment of remainingSegments) {
        if (segment.endOffset <= segment.startOffset) continue;

        const range = this.createRangeFromTextOffsets(
          root,
          segment.startOffset,
          segment.endOffset
        );
        if (!range || !range.toString()) continue;

        const anchor = this.createTextHighlightAnchor(range, segment.color);
        if (!anchor) continue;

        const marks = this.wrapRangeWithHighlight(range, segment.color);
        if (marks.length === 0) continue;

        const item = await storageService.addTextHighlight(anchor);
        marks.forEach((mark) => {
          mark.dataset.dbxHighlightId = item.id;
          mark.dataset.dbxConversationId = item.conversationId;
        });
      }

      await storageService.save();
    } catch (error) {
      console.error('[TextHighlighter] Failed to partially remove highlight:', error);
    }
  }

  clearRenderedHighlights(): void {
    document
      .querySelectorAll<HTMLElement>('.dbx-text-highlight')
      .forEach(mark => this.unwrapHighlight(mark));
  }
}

export const textHighlighter = new TextHighlighter();
