import { downloadFile, escapeHTML, isSafeHttpUrl, resolveUrl, sanitizeFilename } from '../../core/utils/dom';
import { showConfirmDialog, showToast } from '../../core/utils/ui';
import { pageLifecycle } from '../../core/services/PageLifecycle';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  hasImages?: boolean;
}

export class ExportManager {
  private initialized = false;
  private exportButton: HTMLElement | null = null;
  private dropdownMenu: HTMLElement | null = null;
  private unsubscribeDom: (() => void) | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  init(): void {
    if (this.initialized) {
      this.ensureButtonVisible();
      return;
    }

    this.waitForTopbar();
    this.ensureButtonVisible();
    this.initialized = true;
  }

  private ensureButtonVisible(): void {
    setTimeout(() => {
      const existingBtn = document.getElementById('dbx-export-btn');
      if (!existingBtn) {
        this.waitForTopbar();
        return;
      }
      
      const topbar = document.querySelector('[class*="header-height"]') || 
                   document.querySelector('header') ||
                   document.querySelector('[class*="border-b"]');
      
      if (topbar && !topbar.contains(existingBtn)) {
        existingBtn.remove();
        this.exportButton = null;
        this.addExportButton(topbar as HTMLElement);
      }
    }, 1000);
  }

  private waitForTopbar(): void {
    const checkTopbar = () => {
      const topbar = document.querySelector('[class*="header-height"]') || 
                     document.querySelector('header') ||
                     document.querySelector('[class*="border-b"]');
      
      if (topbar) {
        this.addExportButton(topbar as HTMLElement);
      } else {
        // Keep export accessible even when the host changes its header markup.
        this.addExportButton(document.body);
      }
    };

    checkTopbar();
    if (!this.unsubscribeDom) {
      this.unsubscribeDom = pageLifecycle.onDomChange(() => {
        if (!document.getElementById('dbx-export-btn')) checkTopbar();
      }, 150);
    }
  }

  private addExportButton(topbar: HTMLElement): void {
    const existingBtn = document.getElementById('dbx-export-btn');
    if (existingBtn) return;

    this.exportButton = document.createElement('button');
    this.exportButton.id = 'dbx-export-btn';
    this.exportButton.title = '导出当前已加载的对话';
    this.exportButton.setAttribute('aria-label', '导出对话');
    this.exportButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;
    this.exportButton.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 4px;
      color: var(--dbx-text-primary, #1f2937);
      background: transparent;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      flex-shrink: 0;
    `;

    this.exportButton.setAttribute('data-dbx-name', 'button');
    this.exportButton.setAttribute('data-disabled', 'false');

    this.exportButton.addEventListener('mouseenter', () => {
      this.exportButton!.style.backgroundColor = 'var(--dbx-fill-trans-20-hover, rgba(0, 0, 0, 0.05))';
    });

    this.exportButton.addEventListener('mouseleave', () => {
      this.exportButton!.style.backgroundColor = 'transparent';
    });

    this.exportButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    if (!this.outsideClickHandler) {
      this.outsideClickHandler = (e: MouseEvent) => {
        if (this.dropdownMenu && !this.dropdownMenu.contains(e.target as Node) &&
            !this.exportButton?.contains(e.target as Node)) {
          this.hideDropdown();
        }
      };
      document.addEventListener('click', this.outsideClickHandler);
    }

    if (topbar === document.body) {
      this.exportButton.style.cssText += 'position:fixed;right:20px;top:80px;z-index:10001;background:var(--dbx-surface, #fff);border:1px solid var(--dbx-border, #ddd);';
      document.body.appendChild(this.exportButton);
      return;
    }
    const leftContainer = topbar.querySelector('[class*="flex-row"]');
    const rightContainer = topbar.querySelector('div[class*="justify-end"]');

    if (rightContainer) {
      rightContainer.insertBefore(this.exportButton, rightContainer.firstChild);
    } else if (leftContainer && leftContainer.parentElement === topbar) {
      const newRightContainer = document.createElement('div');
      newRightContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-shrink: 0;';
      topbar.appendChild(newRightContainer);
      newRightContainer.appendChild(this.exportButton);
    } else {
      topbar.appendChild(this.exportButton);
    }
  }

  private toggleDropdown(): void {
    if (this.dropdownMenu && this.dropdownMenu.style.display === 'flex') {
      this.hideDropdown();
    } else {
      this.showDropdown();
    }
  }

  private showDropdown(): void {
    if (!this.dropdownMenu) {
      this.dropdownMenu = document.createElement('div');
      this.dropdownMenu.id = 'dbx-export-dropdown';
      this.dropdownMenu.style.cssText = `
        position: fixed;
        min-width: 148px;
        background: var(--dbx-folder-bg-base, #fff);
        border: 1px solid var(--dbx-line-7, #e5e7eb);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        z-index: 10002;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

      const exportPdfBtn = this.createDropdownItem('导出为 PDF', () => this.exportToPdf());
      const exportTxtBtn = this.createDropdownItem('导出为 TXT', () => this.exportToTxt());
      const exportMdBtn = this.createDropdownItem('导出为 Markdown', () => this.exportToMarkdown());

      this.dropdownMenu.appendChild(exportPdfBtn);
      this.dropdownMenu.appendChild(exportTxtBtn);
      this.dropdownMenu.appendChild(exportMdBtn);
    }

    const rect = this.exportButton!.getBoundingClientRect();
    this.dropdownMenu.style.position = 'fixed';
    this.dropdownMenu.style.right = 'auto';
    this.dropdownMenu.style.display = 'flex';
    document.body.appendChild(this.dropdownMenu);

    const menuWidth = this.dropdownMenu.offsetWidth || 156;
    const menuHeight = this.dropdownMenu.offsetHeight || 132;
    const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - menuHeight - 8);
    const clampedLeft = Math.min(Math.max(8, rect.left), maxLeft);
    const clampedTop = Math.min(Math.max(8, rect.bottom + 4), maxTop);
    this.dropdownMenu.style.left = `${clampedLeft}px`;
    this.dropdownMenu.style.top = `${clampedTop}px`;
  }

  private hideDropdown(): void {
    if (this.dropdownMenu) {
      this.dropdownMenu.style.display = 'none';
    }
  }

  private createDropdownItem(text: string, onClick: () => void): HTMLElement {
    const item = document.createElement('button');
    item.textContent = text;
    item.style.cssText = `
      display: block;
      width: 100%;
      padding: 10px 16px;
      font-size: 14px;
      color: var(--dbx-text-primary, #1f2937);
      background: transparent;
      border: none;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.15s ease;
    `;

    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'var(--dbx-fill-trans-20-hover, rgba(0, 0, 0, 0.05))';
    });

    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideDropdown();
      onClick();
    });

    return item;
  }

  private async getConversationMessages(): Promise<Message[]> {
    const messages: Message[] = [];
    const confirmed = await showConfirmDialog({
      title: '导出当前对话',
      message: '将导出页面当前已加载的消息。长对话可能采用虚拟列表，导出结果不保证包含全部历史记录。是否继续？',
      confirmText: '继续导出',
    });
    if (!confirmed) return messages;

    const chatContainer = document.querySelector('[data-message-id]')?.closest('[class*="v_list_scroller"], main, [class*="page-main"], [class*="chat-container"]') || document.querySelector('main');
    if (!chatContainer) {
      showToast('未检测到当前对话内容', 'warning');
      return messages;
    }

    const messageWrappers = Array.from(chatContainer.querySelectorAll('[data-message-id]'))
      .filter(el => !el.parentElement?.closest('[data-message-id]'));

    messageWrappers.forEach((wrapper) => {
      const contentElements = wrapper.querySelectorAll('[data-render-engine="node"], [data-render-engine="block"]');
      const pluginIdentifiers = Array.from(contentElements).map(el => el.getAttribute('data-plugin-identifier') || '');

      const blockTypes = pluginIdentifiers.map(id => {
        const match = id.match(/block_type:(\d+)/);
        return match ? match[1] : '';
      });

      const isThinking = blockTypes.some(bt => bt === '10040');
      const isRegular = blockTypes.some(bt => bt === '10000');

      const hasSkillContent = pluginIdentifiers.some(id => id.includes('Symbol('));
      const hasMessageBubble = wrapper.querySelector('[class*="bubble"], [class*="send-msg"], [class*="message-bubble"]');
      const hasMarkdownBody = wrapper.querySelector('.flow-markdown-body, [class*="markdown-body"], .md-box-root, [class*="md-box-root"]');
      const hasImageBox = wrapper.querySelector('[class*="image-box"], [class*="image-grid"]');

      if (!isRegular && !isThinking && !hasSkillContent && !hasMessageBubble && !hasMarkdownBody && !hasImageBox) return;

      const userRoleSelector = '[data-testid*="send_message"], [class*="send-msg"], [class*="send_message"], [class*="user-bubble"], [class*="bubble-bg"]';
      const role: 'user' | 'assistant' = (
        (typeof wrapper.matches === 'function' && wrapper.matches(userRoleSelector)) ||
        !!wrapper.querySelector(userRoleSelector)
      ) ? 'user' : 'assistant';

      const clone = wrapper.cloneNode(true) as HTMLElement;

      const removeSelectors = [
        'svg:not([data-dbx-name])',
        'button:not([data-dbx-name])',
        '[class*="avatar"]',
        '[class*="time"]',
        '[class*="tool"]',
        '[class*="collapse"]',
        '[class*="think-block"]',
        '[class*="thinking"]',
        '[class*="collapse-button"]',
        '[class*="collapse-wrapper"]',
        '[class*="scroll-content"]',
        '[class*="scroll-view"]',
        '[class*="action-bar"]',
        '[class*="message-action"]',
        '[class*="table-header"]',
        '[class*="header-wrapper"]',
        '[class*="select-none"]',
        '[class*="opacity-0"]',
        '.dbx-latex-btn-container',
        '.dbx-latex-code-btn-container',
        'script',
        'style',
        '.children-wrapper',
        '.scrollable-Se7zNt'
      ];

      removeSelectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(node => node.remove());
      });

      // Remove Doubao's standalone "表格" / "复制" / "下载" toolbar labels left above tables/code blocks.
      clone.querySelectorAll('div, span, header').forEach(node => {
        if (node.querySelector('table, pre, code, img, p, ul, ol, h1, h2, h3, h4')) return;
        const text = node.textContent?.trim();
        if (text === '表格' || text === '复制' || text === '复制表格' || text === '下载') {
          node.remove();
        }
      });

      let content = '';
      const hasImages = clone.querySelectorAll('img').length > 0;

      content = clone.innerHTML.trim();

      const cleanContent = typeof content === 'string' ? content.replace(/\s+/g, ' ').trim() : content;

      if (cleanContent && cleanContent.length > 0) {
        messages.push({
          id: wrapper.getAttribute('data-message-id') || `msg_${messages.length}`,
          role,
          content,
          hasImages
        });
      }
    });

    return messages;
  }

  private getConversationTitle(): string {
    const titleEl = document.querySelector('[class*="title"]:not([class*="icon"]):not([class*="button"]):not([class*="tooltip"])');
    if (titleEl && titleEl.textContent?.trim()) {
      return titleEl.textContent.trim().substring(0, 50);
    }

    const h1El = document.querySelector('h1');
    if (h1El && h1El.textContent?.trim()) {
      return h1El.textContent.trim().substring(0, 50);
    }

    const mainTitle = document.querySelector('[data-testid*="title"], [data-title]');
    if (mainTitle && mainTitle.textContent?.trim()) {
      return mainTitle.textContent.trim().substring(0, 50);
    }

    const urlMatch = window.location.pathname.match(/\/chat\/([^/?#]+)/);
    if (urlMatch) {
      return `对话_${urlMatch[1].substring(0, 8)}`;
    }

    return '对话导出';
  }

  private htmlToMarkdown(html: string): string {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const processNode = (node: Node, insidePre = false): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        const raw = node.textContent || '';
        return insidePre ? raw : raw.replace(/[ \t]{2,}/g, ' ');
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      switch (tagName) {
        case 'br':
          return '\n';
        case 'p': {
          const text = Array.from(el.childNodes).map(c => processNode(c, insidePre)).join('').trim();
          return text ? `${text}\n\n` : '';
        }
        case 'div':
          return Array.from(el.childNodes).map(c => processNode(c, insidePre)).join('') + '\n';
        case 'span':
          return Array.from(el.childNodes).map(c => processNode(c, insidePre)).join('');
        case 'strong':
        case 'b':
          return `**${Array.from(el.childNodes).map(c => processNode(c, insidePre)).join('')}**`;
        case 'em':
        case 'i':
          return `*${Array.from(el.childNodes).map(c => processNode(c, insidePre)).join('')}*`;
        case 'code': {
          const codeContent = Array.from(el.childNodes).map(c => processNode(c, true)).join('');
          if (insidePre || el.closest?.('pre')) {
            return `\n\`\`\`\n${codeContent}\n\`\`\`\n`;
          }
          return `\`${codeContent}\``;
        }
        case 'pre': {
          const preCode = el.querySelector('code');
          const codeText = preCode ? preCode.textContent || '' : el.textContent || '';
          const langClass = preCode?.className?.match(/language-(\w+)/);
          const lang = langClass ? langClass[1] : '';
          return `\n\`\`\`${lang}\n${codeText.replace(/^\n+|\n+$/g, '')}\n\`\`\`\n\n`;
        }
        case 'a': {
          const href = el.getAttribute('href') || '';
          return `[${el.textContent || ''}](${href})`;
        }
        case 'img': {
          const rawSrc = el.getAttribute('src') || el.getAttribute('data-src') || '';
          if (!rawSrc || rawSrc.startsWith('data:') || rawSrc.toLowerCase().includes('base64')) {
            return '';
          }
          const src = resolveUrl(rawSrc);
          const alt = el.getAttribute('alt') || 'image';
          return src ? `![${alt}](${src})` : '';
        }
        case 'ul': {
          const items = Array.from(el.childNodes).filter(
            c => c.nodeType === Node.ELEMENT_NODE && (c as Element).tagName.toLowerCase() === 'li'
          );
          if (items.length === 0) return '';
          return items.map(li => {
            const body = processNode(li, false).trim().replace(/\n/g, '\n  ');
            return `- ${body}`;
          }).join('\n') + '\n\n';
        }
        case 'ol': {
          const items = Array.from(el.childNodes).filter(
            c => c.nodeType === Node.ELEMENT_NODE && (c as Element).tagName.toLowerCase() === 'li'
          );
          if (items.length === 0) return '';
          let idx = 1;
          return items.map(li => {
            const body = processNode(li, false).trim().replace(/^\s*-\s*/, '').replace(/\n/g, '\n  ');
            return `${idx++}. ${body}`;
          }).join('\n') + '\n\n';
        }
        case 'li':
          return Array.from(el.childNodes).map(c => processNode(c, insidePre)).join('');
        case 'h1':
          return `# ${el.textContent || ''}\n\n`;
        case 'h2':
          return `## ${el.textContent || ''}\n\n`;
        case 'h3':
          return `### ${el.textContent || ''}\n\n`;
        case 'h4':
          return `#### ${el.textContent || ''}\n\n`;
        case 'blockquote':
          return `> ${el.textContent || ''}\n\n`;
        case 'hr':
          return '---\n\n';
        case 'table': {
          const rows: string[][] = [];
          el.querySelectorAll('tr').forEach(tr => {
            const cells: string[] = [];
            tr.querySelectorAll('th, td').forEach(cell => {
              cells.push(processNode(cell, false).trim().replace(/\|/g, '\\|'));
            });
            if (cells.length > 0) rows.push(cells);
          });
          if (rows.length === 0) return '';
          const header = rows[0].join(' | ');
          const separator = rows[0].map(() => '---').join(' | ');
          const body = rows.slice(1).map(row => `| ${row.join(' | ')} |`).join('\n');
          return `\n| ${header} |\n| ${separator} |\n${body ? `${body}\n` : ''}\n`;
        }
        default:
          return Array.from(el.childNodes).map(c => processNode(c, insidePre)).join('');
      }
    };

    let markdown = processNode(temp, false);
    markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
    return markdown;
  }

  private sanitizeHtmlForPdf(content: string): string {
    const temp = document.createElement('div');
    temp.innerHTML = content;

    temp.querySelectorAll('script, iframe, object, embed, form, meta, link, base, style').forEach(node => node.remove());

    const cleanImageWrappers = temp.querySelectorAll('[class*="image-wrapper"], [class*="image-box-grid"], [class*="container-MzuYIN"], [class*="container-dLabXv"], [class*="image-box-grid-item"]');
    cleanImageWrappers.forEach((wrapper) => {
      const imgs = wrapper.querySelectorAll('img');
      imgs.forEach((img) => {
        const parent = wrapper.parentElement;
        if (parent) {
          parent.insertBefore(img.cloneNode(true), wrapper);
        }
      });
      wrapper.remove();
    });

    const pictureElements = temp.querySelectorAll('picture');
    pictureElements.forEach((picture) => {
      const sources = picture.querySelectorAll('source');
      const img = picture.querySelector('img');
      if (img) {
        sources.forEach((source) => {
          const srcset = source.getAttribute('srcset');
          if (srcset && !srcset.includes('data:')) {
            img.setAttribute('src', srcset.split(' ')[0]);
          }
        });
      }
    });

    const imgs = temp.querySelectorAll('img');
    imgs.forEach((img) => {
      const rawSrc = img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (!rawSrc) {
        img.remove();
        return;
      }

      const lowerSrc = rawSrc.toLowerCase();
      if (lowerSrc.includes('data:image/svg') || lowerSrc.includes('width=2048') || lowerSrc.includes('width="2048') || !isSafeHttpUrl(rawSrc)) {
        img.remove();
        return;
      }

      img.setAttribute('src', resolveUrl(rawSrc));
    });

    // Strip unsafe attributes and Doubao's layout styles/classes (e.g., fixed heights,
    // transforms, overflow boxes) that otherwise create huge vertical blanks in print output.
    const allowedAttrs = new Set(['href', 'src', 'alt', 'colspan', 'rowspan', 'align']);
    temp.querySelectorAll('*').forEach((node) => {
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();
        if (name.startsWith('on')) {
          node.removeAttribute(attr.name);
        } else if (name === 'href' || name === 'src' || name === 'xlink:href') {
          if (!value || (!isSafeHttpUrl(value) && !value.startsWith('#'))) {
            node.removeAttribute(attr.name);
          }
        } else if (!allowedAttrs.has(name)) {
          node.removeAttribute(attr.name);
        }
      }
    });

    // Remove residual standalone table/code toolbar text labels.
    temp.querySelectorAll('div, span, header').forEach((node) => {
      if (node.querySelector('table, pre, code, img, p, ul, ol, h1, h2, h3, h4')) return;
      const text = node.textContent?.trim();
      if (text === '表格' || text === '复制' || text === '复制表格' || text === '下载') {
        node.remove();
      }
    });

    // Prune empty layout wrapper elements from bottom up to prevent blank vertical gaps.
    const voidOrMedia = 'img, table, tr, td, th, hr, pre, code, math';
    const allNodes = Array.from(temp.querySelectorAll('div, p, span, section, article, header, footer'));
    for (let i = allNodes.length - 1; i >= 0; i--) {
      const el = allNodes[i];
      if (!el.querySelector(voidOrMedia) && !(el.textContent?.trim())) {
        el.remove();
      }
    }

    // Collapse runs of consecutive <br> tags into a single line break (ignoring whitespace-only text nodes between them).
    Array.from(temp.querySelectorAll('br')).forEach((br) => {
      let prev: Node | null = br.previousSibling;
      while (prev && prev.nodeType === Node.TEXT_NODE && !(prev.textContent || '').trim()) {
        prev = prev.previousSibling;
      }
      if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as Element).tagName.toUpperCase() === 'BR') {
        br.remove();
      }
    });

    return temp.innerHTML;
  }

  private async exportToPdf(): Promise<void> {
    const messages = await this.getConversationMessages();
    if (!messages.length) return;
    const title = this.getConversationTitle();
    const safeTitle = escapeHTML(title);
    const exportDate = new Date().toLocaleString('zh-CN');
    
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${safeTitle}</title>
        <style>
          @page {
            size: A4;
            margin: 14mm 15mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', Roboto, sans-serif;
            font-size: 12.5px;
            line-height: 1.65;
            color: #1f2937;
            background: #ffffff;
            margin: 0 auto;
            padding: 20px 24px;
            max-width: 820px;
          }
          .doc-header {
            margin-bottom: 18px;
            padding-bottom: 12px;
            border-bottom: 1.5px solid #e5e7eb;
          }
          .doc-title {
            font-size: 18px;
            font-weight: 700;
            color: #111827;
            margin: 0 0 6px 0;
            line-height: 1.35;
          }
          .meta {
            font-size: 11px;
            color: #6b7280;
          }
          .conversation {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .message {
            padding: 12px 16px;
            border-radius: 10px;
            border: 1px solid #e5e7eb;
          }
          .message-user {
            background: #f5f7ff;
            border-color: #e0e7ff;
          }
          .message-assistant {
            background: #ffffff;
            border-color: #eceef2;
          }
          .role {
            display: inline-block;
            font-size: 10.5px;
            font-weight: 600;
            padding: 1px 8px;
            border-radius: 999px;
            margin-bottom: 8px;
            letter-spacing: 0.3px;
          }
          .message-user .role {
            background: #e0e7ff;
            color: #3730a3;
          }
          .message-assistant .role {
            background: #f3f4f6;
            color: #4b5563;
          }
          .content {
            white-space: normal;
            word-wrap: break-word;
            overflow-wrap: break-word;
            margin: 0;
            padding: 0;
          }
          .content > :first-child {
            margin-top: 0;
          }
          .content > :last-child {
            margin-bottom: 0;
          }
          .content p {
            margin: 6px 0;
          }
          .content h1, .content h2, .content h3, .content h4 {
            color: #111827;
            font-weight: 600;
            line-height: 1.4;
            margin: 14px 0 6px;
            break-after: avoid;
            page-break-after: avoid;
          }
          .content h1 { font-size: 15.5px; }
          .content h2 { font-size: 14.5px; }
          .content h3 { font-size: 13.5px; }
          .content h4 { font-size: 12.5px; }
          .content ul, .content ol {
            margin: 6px 0;
            padding-left: 22px;
          }
          .content li {
            margin: 3px 0;
          }
          .content strong, .content b {
            font-weight: 600;
            color: #111827;
          }
          .content blockquote {
            margin: 8px 0;
            padding: 6px 12px;
            border-left: 3px solid #6366f1;
            background: #f8fafc;
            color: #4b5563;
            border-radius: 0 6px 6px 0;
            break-inside: avoid;
          }
          .content hr {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 12px 0;
          }
          .content table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0 12px;
            font-size: 11.5px;
            line-height: 1.5;
            border: 1px solid #d1d5db;
            table-layout: auto;
          }
          .content thead {
            display: table-header-group;
          }
          .content tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .content th, .content td {
            padding: 7px 10px;
            border: 1px solid #e5e7eb;
            text-align: left;
            vertical-align: top;
            word-break: break-word;
          }
          .content th {
            background: #f3f4f6;
            color: #111827;
            font-weight: 600;
            border-bottom: 1.5px solid #d1d5db;
          }
          .content tbody tr:nth-child(even) {
            background: #f9fafb;
          }
          .content pre {
            background: #f6f8fa;
            border: 1px solid #e1e4e8;
            border-radius: 6px;
            padding: 10px 12px;
            margin: 8px 0;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            line-height: 1.5;
            break-inside: avoid;
          }
          .content :not(pre) > code {
            background: #f3f4f6;
            color: #c026d3;
            padding: 1px 5px;
            border-radius: 4px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11.5px;
          }
          .content img {
            max-width: 100%;
            max-height: 360px;
            height: auto;
            border-radius: 6px;
            margin: 6px 4px;
            display: inline-block;
            vertical-align: top;
            break-inside: avoid;
          }
          .content a {
            color: #4f46e5;
            text-decoration: underline;
          }
          @media print {
            body {
              padding: 0;
              max-width: none;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <h1 class="doc-title">${safeTitle}</h1>
          <div class="meta">导出时间: ${exportDate} · 共 ${messages.length} 条消息（用户: ${userMessages.length}, AI: ${assistantMessages.length}）</div>
        </div>
        <div class="conversation">
          ${messages.map(m => `
            <div class="message message-${m.role}">
              <div class="role">${m.role === 'user' ? '用户' : 'AI'}</div>
              <div class="content">${this.sanitizeHtmlForPdf(m.content)}</div>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  }

  private async exportToTxt(): Promise<void> {
    const messages = await this.getConversationMessages();
    if (!messages.length) return;
    const title = this.getConversationTitle();
    const date = new Date().toLocaleDateString('zh-CN');
    const userCount = messages.filter(m => m.role === 'user').length;
    const aiCount = messages.filter(m => m.role === 'assistant').length;
    
    const content = [
      title,
      '─'.repeat(40),
      `导出日期: ${date}`,
      `共 ${messages.length} 条消息（用户: ${userCount}, AI: ${aiCount}）`,
      '',
      ...messages.map(m => {
        const role = m.role === 'user' ? '【用户】' : '【AI】';
        const msgContent = this.htmlToMarkdown(m.content);
        return `${role}\n${msgContent}\n`;
      })
    ].join('\n');

    downloadFile(content, `${sanitizeFilename(title, '对话导出')}.txt`, 'text/plain;charset=utf-8');
    showToast(`已导出 TXT（共 ${messages.length} 条消息）`, 'success');
  }

  private async exportToMarkdown(): Promise<void> {
    const messages = await this.getConversationMessages();
    if (!messages.length) return;
    const title = this.getConversationTitle();
    const date = new Date().toLocaleDateString('zh-CN');
    const userCount = messages.filter(m => m.role === 'user').length;
    const aiCount = messages.filter(m => m.role === 'assistant').length;
    
    const content = [
      `# ${title}`,
      '',
      `> 导出日期: ${date}`,
      `> 共 ${messages.length} 条消息（用户: ${userCount}, AI: ${aiCount}）`,
      '',
      '---',
      '',
      ...messages.map(m => {
        const role = m.role === 'user' ? '**用户**' : '**AI**';
        const msgContent = this.htmlToMarkdown(m.content);
        return `### ${role}\n\n${msgContent}`;
      })
    ].join('\n');

    downloadFile(content, `${sanitizeFilename(title, '对话导出')}.md`, 'text/markdown;charset=utf-8');
    showToast(`已导出 Markdown（共 ${messages.length} 条消息）`, 'success');
  }

  destroy(): void {
    this.unsubscribeDom?.();
    this.unsubscribeDom = null;
    if (this.outsideClickHandler) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    this.dropdownMenu?.remove();
    this.dropdownMenu = null;
    this.exportButton?.remove();
    this.exportButton = null;
    this.initialized = false;
  }
}

export const exportManager = new ExportManager();
