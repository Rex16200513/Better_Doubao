export class LatexDownloader {
  private initialized = false;
  private processedElements = new WeakSet<HTMLElement>();

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    
    this.setupObserver();
    // Try multiple times with increasing delays
    setTimeout(() => this.processExistingFormulas(), 500);
    setTimeout(() => this.processExistingFormulas(), 1500);
    setTimeout(() => this.processExistingFormulas(), 3000);
  }

  private setupObserver(): void {
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) {
              if (node.querySelector('.math-inline, .math-block, .custom-code-block-container--latex, [copy-text]') ||
                  node.classList?.contains('math-inline') || node.classList?.contains('math-block')) {
                shouldProcess = true;
                break;
              }
            }
          }
        }
        // Detect when copy-text attribute is added to existing elements
        if (mutation.type === 'attributes' && (mutation.attributeName === 'copy-text' || mutation.attributeName === 'data-custom-copy-text')) {
          shouldProcess = true;
          break;
        }
        if (shouldProcess) break;
      }
      
      if (shouldProcess) {
        setTimeout(() => this.processExistingFormulas(), 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['copy-text', 'data-custom-copy-text'],
    });
  }

  private processExistingFormulas(): void {
    // Find .math-inline or .math-block elements that have copy-text attribute
    const formulaElements = document.querySelectorAll('.math-inline[copy-text], .math-block[copy-text], .math-inline[data-custom-copy-text], .math-block[data-custom-copy-text]');
    
    console.log(`[LatexDownloader] Found ${formulaElements.length} formula elements with copy-text`);

    formulaElements.forEach(el => {
      const element = el as HTMLElement;
      if (!this.processedElements.has(element)) {
        this.processedElements.add(element);
        this.addDownloadButton(element, 'inline');
      }
    });

    // Also try legacy approach for elements without copy-text
    const inlineMath = document.querySelectorAll('.math-inline:not([copy-text]):not([data-custom-copy-text])');
    const blockMath = document.querySelectorAll('.math-block:not([copy-text]):not([data-custom-copy-text])');
    const latexCodeBlocks = document.querySelectorAll('.custom-code-block-container--latex');

    inlineMath.forEach(el => {
      const element = el as HTMLElement;
      if (!this.processedElements.has(element)) {
        this.processedElements.add(element);
        this.addDownloadButton(element, 'inline');
      }
    });
    blockMath.forEach(el => {
      const element = el as HTMLElement;
      if (!this.processedElements.has(element)) {
        this.processedElements.add(element);
        this.addDownloadButton(element, 'block');
      }
    });
    latexCodeBlocks.forEach(el => {
      const element = el as HTMLElement;
      if (!this.processedElements.has(element)) {
        this.processedElements.add(element);
        this.addLatexCodeDownloadButton(element);
      }
    });
  }

  private extractLatexCode(element: HTMLElement): string | null {
    const copyText = element.getAttribute('copy-text') || element.getAttribute('data-custom-copy-text');
    if (!copyText) return null;

    // Try to extract content between \( and \) or \[ and \]
    let match = copyText.match(/\\\(([\s\S]*?)\\\)/);
    if (match) return match[1].trim();

    match = copyText.match(/\\\[([\s\S]*?)\\\]/);
    if (match) return match[1].trim();

    // If no delimiters found, return as-is
    return copyText.trim();
  }

  private addDownloadButton(element: HTMLElement, _type: 'inline' | 'block'): void {
    if (element.querySelector('.dbx-latex-download-btn')) return;

    const latex = this.extractLatexCode(element);
    if (!latex) return;

    const btnContainer = document.createElement('span');
    btnContainer.className = 'dbx-latex-btn-container';
    btnContainer.style.cssText = 'display: inline-flex; align-items: center; margin-left: 6px; gap: 4px; vertical-align: middle;';

    const downloadBtn = document.createElement('span');
    downloadBtn.className = 'dbx-latex-download-btn';
    downloadBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    `;
    downloadBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      cursor: pointer;
      color: #888;
      border-radius: 4px;
      transition: all 0.2s;
      flex-shrink: 0;
    `;

    downloadBtn.addEventListener('mouseenter', () => {
      downloadBtn.style.backgroundColor = '#f0f0f0';
      downloadBtn.style.color = '#333';
    });

    downloadBtn.addEventListener('mouseleave', () => {
      downloadBtn.style.backgroundColor = 'transparent';
      downloadBtn.style.color = '#888';
    });

    downloadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.downloadLatex(latex);
    });

    const copyBtn = document.createElement('span');
    copyBtn.className = 'dbx-latex-copy-btn';
    copyBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    `;
    copyBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      cursor: pointer;
      color: #888;
      border-radius: 4px;
      transition: all 0.2s;
      flex-shrink: 0;
    `;

    copyBtn.addEventListener('mouseenter', () => {
      copyBtn.style.backgroundColor = '#f0f0f0';
      copyBtn.style.color = '#333';
    });

    copyBtn.addEventListener('mouseleave', () => {
      copyBtn.style.backgroundColor = 'transparent';
      copyBtn.style.color = '#888';
    });

    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyToClipboard(latex, copyBtn);
    });

    btnContainer.appendChild(downloadBtn);
    btnContainer.appendChild(copyBtn);

    // Insert after the formula element
    if (element.parentNode) {
      const nextSibling = element.nextSibling;
      if (nextSibling) {
        element.parentNode.insertBefore(btnContainer, nextSibling);
      } else {
        element.parentNode.appendChild(btnContainer);
      }
    }
  }

  private addLatexCodeDownloadButton(element: HTMLElement): void {
    const existingBtn = element.querySelector('.dbx-latex-code-download-btn');
    if (existingBtn) return;

    const codeArea = element.querySelector('code');
    if (!codeArea) return;

    const latexCode = codeArea.textContent?.trim() || '';
    if (!latexCode) return;

    const header = element.querySelector('.header-wrapper-Mbk8s6, .header-IAeXdE');
    if (!header) return;

    const btnContainer = document.createElement('span');
    btnContainer.className = 'dbx-latex-code-btn-container';
    btnContainer.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; gap: 4px;';

    const downloadBtn = document.createElement('span');
    downloadBtn.className = 'dbx-latex-code-download-btn';
    downloadBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    `;
    downloadBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      cursor: pointer;
      color: #666;
      border-radius: 4px;
      transition: all 0.2s;
    `;

    downloadBtn.title = 'Download LaTeX';

    downloadBtn.addEventListener('mouseenter', () => {
      downloadBtn.style.backgroundColor = '#f0f0f0';
      downloadBtn.style.color = '#333';
    });

    downloadBtn.addEventListener('mouseleave', () => {
      downloadBtn.style.backgroundColor = 'transparent';
      downloadBtn.style.color = '#666';
    });

    downloadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.downloadLatexCode(latexCode);
    });

    const copyBtn = document.createElement('span');
    copyBtn.className = 'dbx-latex-code-copy-btn';
    copyBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    `;
    copyBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      cursor: pointer;
      color: #666;
      border-radius: 4px;
      transition: all 0.2s;
    `;

    copyBtn.title = 'Copy LaTeX';

    copyBtn.addEventListener('mouseenter', () => {
      copyBtn.style.backgroundColor = '#f0f0f0';
      copyBtn.style.color = '#333';
    });

    copyBtn.addEventListener('mouseleave', () => {
      copyBtn.style.backgroundColor = 'transparent';
      copyBtn.style.color = '#666';
    });

    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyToClipboard(latexCode, copyBtn);
    });

    btnContainer.appendChild(downloadBtn);
    btnContainer.appendChild(copyBtn);

    const actionBar = element.querySelector('.action-ysQCxz');
    if (actionBar) {
      actionBar.appendChild(btnContainer);
    } else {
      header.appendChild(btnContainer);
    }
  }

  private downloadLatex(latex: string): void {
    const content = this.wrapLatexDocument(latex);
    const filename = `formula_${Date.now()}.tex`;
    this.downloadFile(content, filename, 'text/plain');
  }

  private downloadLatexCode(code: string): void {
    const content = this.wrapLatexDocument(code);
    const filename = `latex_${Date.now()}.tex`;
    this.downloadFile(content, filename, 'text/plain');
  }

  private async copyToClipboard(text: string, btnElement: HTMLElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      const originalHTML = btnElement.innerHTML;
      btnElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;
      btnElement.style.color = '#4CAF50';
      setTimeout(() => {
        btnElement.innerHTML = originalHTML;
        btnElement.style.color = '#666';
      }, 1500);
    } catch (err) {
      console.error('[LatexDownloader] Copy failed:', err);
    }
  }

  private wrapLatexDocument(latex: string): string {
    return `% LaTeX Document
% Generated by Better Doubao
% Date: ${new Date().toLocaleString()}

\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amssymb}

\\begin{document}

${latex}

\\end{document}
`;
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

export const latexDownloader = new LatexDownloader();
