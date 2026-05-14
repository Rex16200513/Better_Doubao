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

  init(): void {
    if (this.initialized) {
      this.ensureButtonVisible();
      return;
    }

    console.log('[ExportManager] Initializing...');
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
        console.log('[ExportManager] Topbar found, adding export button');
        this.addExportButton(topbar as HTMLElement);
      } else {
        setTimeout(checkTopbar, 500);
      }
    };

    checkTopbar();
  }

  private addExportButton(topbar: HTMLElement): void {
    const existingBtn = document.getElementById('dbx-export-btn');
    if (existingBtn) return;

    this.exportButton = document.createElement('button');
    this.exportButton.id = 'dbx-export-btn';
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

    document.addEventListener('click', (e) => {
      if (this.dropdownMenu && !this.dropdownMenu.contains(e.target as Node) && 
          !this.exportButton?.contains(e.target as Node)) {
        this.hideDropdown();
      }
    });
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
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 4px;
        min-width: 140px;
        background: var(--dbx-folder-bg-base, #fff);
        border: 1px solid var(--dbx-line-7, #e5e7eb);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        z-index: 10000;
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
    this.dropdownMenu.style.left = `${rect.left}px`;
    this.dropdownMenu.style.top = `${rect.bottom}px`;
    this.dropdownMenu.style.display = 'flex';
    document.body.appendChild(this.dropdownMenu);
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

    const chatContainer = document.querySelector('[data-message-id]')?.closest('main, [class*="page-main"], [class*="chat-container"]') || document.querySelector('main');
    if (!chatContainer) {
      console.log('[ExportManager] Chat container not found');
      return messages;
    }

    const messageWrappers = chatContainer.querySelectorAll('[data-message-id]');
    console.log('[ExportManager] Found message wrappers:', messageWrappers.length);

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
      const hasMarkdownBody = wrapper.querySelector('.flow-markdown-body, [class*="markdown-body"]');
      const hasImageBox = wrapper.querySelector('[class*="image-box"], [class*="image-grid"]');

      if (!isRegular && !isThinking && !hasSkillContent && !hasMessageBubble && !hasMarkdownBody && !hasImageBox) return;

      const wrapperHtml = wrapper.innerHTML?.toLowerCase() || '';
      const role: 'user' | 'assistant' = wrapperHtml.includes('send_message') ||
        wrapper.querySelector('[class*="send-msg"], [class*="send_message"], [class*="user-bubble"], [class*="bubble-bg"]') ? 'user' : 'assistant';

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
        '[class*="select-none"]',
        '[class*="opacity-0"]',
        'script',
        'style',
        '.children-wrapper',
        '.scrollable-Se7zNt'
      ];

      removeSelectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(node => node.remove());
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

    console.log('[ExportManager] Found messages:', messages.length, 'user:', messages.filter(m => m.role === 'user').length, 'assistant:', messages.filter(m => m.role === 'assistant').length, 'with images:', messages.filter(m => m.hasImages).length);
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

    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      switch (tagName) {
        case 'br':
          return '\n';
        case 'p':
          return Array.from(el.childNodes).map(processNode).join('\n\n') + '\n';
        case 'div':
          return Array.from(el.childNodes).map(processNode).join('\n') + '\n';
        case 'span':
          return Array.from(el.childNodes).map(processNode).join('');
        case 'strong':
        case 'b':
          return `**${Array.from(el.childNodes).map(processNode).join('')}**`;
        case 'em':
        case 'i':
          return `*${Array.from(el.childNodes).map(processNode).join('')}*`;
        case 'code':
          const codeContent = Array.from(el.childNodes).map(processNode).join('');
          if (el.closest('pre')) {
            return `\n\`\`\`\n${codeContent}\n\`\`\`\n`;
          }
          return `\`${codeContent}\``;
        case 'pre':
          const preCode = el.querySelector('code');
          const codeText = preCode ? preCode.textContent || '' : el.textContent || '';
          const langClass = preCode?.className.match(/language-(\w+)/);
          const lang = langClass ? langClass[1] : '';
          return `\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n`;
        case 'a':
          const href = el.getAttribute('href') || '';
          return `[${el.textContent || ''}](${href})`;
        case 'img':
          const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
          if (src.startsWith('data:') || src.includes('base64')) {
            return '';
          }
          const alt = el.getAttribute('alt') || 'image';
          return src ? `![${alt}](${src})` : '';
        case 'ul':
          return Array.from(el.childNodes).map(li => `  - ${processNode(li)}`).join('\n') + '\n';
        case 'ol':
          let idx = 1;
          return Array.from(el.childNodes).map(li => `  ${idx++}. ${processNode(li).replace(/^\s*-\s*/, '')}`).join('\n') + '\n';
        case 'li':
          return Array.from(el.childNodes).map(processNode).join('');
        case 'h1':
          return `# ${el.textContent || ''}\n`;
        case 'h2':
          return `## ${el.textContent || ''}\n`;
        case 'h3':
          return `### ${el.textContent || ''}\n`;
        case 'h4':
          return `#### ${el.textContent || ''}\n`;
        case 'blockquote':
          return `> ${el.textContent || ''}\n`;
        case 'hr':
          return '---\n';
        case 'table':
          const rows: string[][] = [];
          el.querySelectorAll('tr').forEach(tr => {
            const cells: string[] = [];
            tr.querySelectorAll('th, td').forEach(cell => {
              cells.push(processNode(cell).trim());
            });
            if (cells.length > 0) rows.push(cells);
          });
          if (rows.length === 0) return '';
          const header = rows[0].join(' | ');
          const separator = rows[0].map(() => '---').join(' | ');
          const body = rows.slice(1).map(row => row.join(' | ')).join('\n');
          return `\n| ${header} |\n| ${separator} |\n${body ? '| ' + body.replace(/\n/g, '\n| ') + '|' : ''}\n`;
        default:
          return Array.from(el.childNodes).map(processNode).join('');
      }
    };

    let markdown = processNode(temp);
    markdown = markdown.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();
    return markdown;
  }

  private async exportToPdf(): Promise<void> {
    console.log('[ExportManager] Exporting to PDF...');
    
    const messages = await this.getConversationMessages();
    const title = this.getConversationTitle();
    
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    const processContentForPdf = (content: string): string => {
       const temp = document.createElement('div');
       temp.innerHTML = content;

       const codeBlocks = temp.querySelectorAll('pre code, pre');
       codeBlocks.forEach((block) => {
         const pre = block.tagName === 'PRE' ? block as HTMLElement : block.parentElement as HTMLElement;
         if (pre) {
           pre.style.cssText = 'background: #f6f8fa; border-radius: 6px; padding: 12px; margin: 8px 0; overflow-x: auto; font-family: monospace; font-size: 11px; line-height: 1.4; border: 1px solid #e1e4e8;';
         }
       });

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
         const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
         if (!src) return;

         const lowerSrc = src.toLowerCase();
         if (lowerSrc.includes('data:image/svg') || lowerSrc.includes('width=2048') || lowerSrc.includes('width="2048')) {
           img.remove();
           return;
         }

         if (src.startsWith('//') || src.startsWith('/')) {
           img.setAttribute('src', 'https:' + src);
         }
         (img as HTMLElement).style.cssText = 'max-width: 200px; height: auto; border-radius: 4px; margin: 4px; display: inline-block; vertical-align: top;';
         img.onerror = function() {
           (this as HTMLImageElement).style.display = 'none';
         };
       });

       const h1s = temp.querySelectorAll('h1');
       h1s.forEach((h1) => {
         (h1 as HTMLElement).style.cssText = 'font-size: 14px; font-weight: 600; margin: 12px 0 8px 0; color: #1f2937;';
       });

       const h2s = temp.querySelectorAll('h2');
       h2s.forEach((h2) => {
         (h2 as HTMLElement).style.cssText = 'font-size: 13px; font-weight: 600; margin: 10px 0 6px 0; color: #374151;';
       });

       const uls = temp.querySelectorAll('ul, ol');
       uls.forEach((ul) => {
         (ul as HTMLElement).style.cssText = 'margin: 8px 0; padding-left: 20px;';
       });

       const lis = temp.querySelectorAll('li');
       lis.forEach((li) => {
         (li as HTMLElement).style.cssText = 'margin: 4px 0;';
       });

       const ps = temp.querySelectorAll('p');
       ps.forEach((p) => {
         (p as HTMLElement).style.cssText = 'margin: 8px 0;';
       });

       const srs = temp.querySelectorAll('strong');
       srs.forEach((s) => {
         (s as HTMLElement).style.cssText = 'font-weight: 600;';
       });

       return temp.innerHTML;
     };
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #1f2937;
            background: #fff;
            padding: 15px;
            max-width: 100%;
          }
          h1 {
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 12px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #e5e7eb;
          }
          .meta {
            font-size: 11px;
            color: #6b7280;
            margin-bottom: 16px;
          }
          .conversation {
            display: flex;
            flex-direction: column;
          }
          .message {
            padding: 10px 12px;
            border-radius: 6px;
            break-inside: avoid;
            margin-bottom: 8px;
          }
          .message-user {
            background: #f3f4f6;
            margin-right: 40px;
          }
          .message-assistant {
            background: #f9fafb;
            margin-left: 40px;
          }
          .message:last-child {
            margin-bottom: 0;
          }
          .role {
            font-size: 10px;
            font-weight: 600;
            margin-bottom: 2px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .message-user .role {
            color: #4b5563;
          }
          .message-assistant .role {
            color: #6b7280;
          }
          .content {
            white-space: pre-wrap;
            word-wrap: break-word;
            margin: 0;
            padding: 0;
          }
          .content p {
            margin: 0 0 4px 0;
          }
          .content p:last-child {
            margin-bottom: 0;
          }
          @media print {
            body {
              padding: 0;
            }
            .message {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">共 ${messages.length} 条消息（用户: ${userMessages.length}, AI: ${assistantMessages.length}）</div>
        <div class="conversation">
          ${messages.map(m => `
            <div class="message message-${m.role}">
              <div class="role">${m.role === 'user' ? '用户' : 'AI'}</div>
              <div class="content">${processContentForPdf(m.content)}</div>
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
    console.log('[ExportManager] Exporting to TXT...');
    
    const messages = await this.getConversationMessages();
    const title = this.getConversationTitle();
    const date = new Date().toLocaleDateString('zh-CN');
    const userCount = messages.filter(m => m.role === 'user').length;
    const aiCount = messages.filter(m => m.role === 'assistant').length;
    
    const extractImgUrls = (htmlContent: string): string[] => {
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      const urls: string[] = [];
      let match;
      while ((match = imgRegex.exec(htmlContent)) !== null) {
        urls.push(match[1]);
      }
      return urls;
    };
    
    const content = [
      title,
      '─'.repeat(40),
      `导出日期: ${date}`,
      `共 ${messages.length} 条消息（用户: ${userCount}, AI: ${aiCount}）`,
      '',
      ...messages.map(m => {
        const role = m.role === 'user' ? '【用户】' : '【AI】';
        const msgContent = this.htmlToMarkdown(m.content);
        if (m.hasImages) {
          const imgUrls = extractImgUrls(m.content);
          if (imgUrls.length > 0) {
            return `${role}\n${msgContent}\n\n[图片: ${imgUrls.join(', ')}]\n`;
          }
        }
        return `${role}\n${msgContent}\n`;
      })
    ].join('\n');

    this.downloadFile(content, `${title}.txt`, 'text/plain;charset=utf-8');
  }

  private async exportToMarkdown(): Promise<void> {
    console.log('[ExportManager] Exporting to Markdown...');
    
    const messages = await this.getConversationMessages();
    const title = this.getConversationTitle();
    const date = new Date().toLocaleDateString('zh-CN');
    const userCount = messages.filter(m => m.role === 'user').length;
    const aiCount = messages.filter(m => m.role === 'assistant').length;
    
    const extractImgUrls = (htmlContent: string): string[] => {
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      const urls: string[] = [];
      let match;
      while ((match = imgRegex.exec(htmlContent)) !== null) {
        urls.push(match[1]);
      }
      return urls;
    };
    
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
        let mdContent = `### ${role}\n\n${msgContent}`;

        if (m.hasImages) {
          const imgUrls = extractImgUrls(m.content);
          imgUrls.forEach(url => {
            mdContent += `\n\n![图片](${url})`;
          });
        }

        return mdContent;
      })
    ].join('\n');

    this.downloadFile(content, `${title}.md`, 'text/markdown;charset=utf-8');
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const exportManager = new ExportManager();
