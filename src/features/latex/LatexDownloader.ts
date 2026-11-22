import { downloadFile } from '../../core/utils/dom';

const DOWNLOAD_ICON_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
`;

const COPY_ICON_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
`;

const CHECK_ICON_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
`;

export class LatexDownloader {
  private initialized = false;
  private processedElements = new WeakSet<HTMLElement>();
  private copyResetTimers = new WeakMap<HTMLElement, number>();
  private copyOriginalIcon = new WeakMap<HTMLElement, { html: string; color: string }>();
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.setupObserver();
    setTimeout(() => this.processExistingFormulas(), 500);
    setTimeout(() => this.processExistingFormulas(), 1500);
    setTimeout(() => this.processExistingFormulas(), 3000);
  }

  private setupObserver(): void {
    this.observer?.disconnect();
    this.observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) {
              if (
                node.classList?.contains('math-inline') ||
                node.classList?.contains('math-block') ||
                node.classList?.contains('custom-code-block-container--latex') ||
                node.hasAttribute?.('copy-text') ||
                node.hasAttribute?.('data-custom-copy-text') ||
                node.querySelector('.math-inline, .math-block, .custom-code-block-container--latex, [copy-text], [data-custom-copy-text]')
              ) {
                shouldProcess = true;
                break;
              }
            }
          }
        }
        if (mutation.type === 'attributes' && (mutation.attributeName === 'copy-text' || mutation.attributeName === 'data-custom-copy-text')) {
          shouldProcess = true;
          break;
        }
        if (shouldProcess) break;
      }

      if (shouldProcess) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = window.setTimeout(() => {
          this.debounceTimer = null;
          this.processExistingFormulas();
        }, 200);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['copy-text', 'data-custom-copy-text'],
    });
  }

  private processExistingFormulas(): void {
    const formulaElements = document.querySelectorAll('.math-inline[copy-text], .math-block[copy-text], .math-inline[data-custom-copy-text], .math-block[data-custom-copy-text]');

    formulaElements.forEach(el => {
      const element = el as HTMLElement;
      const kind = element.classList?.contains('math-block') ? 'block' : 'inline';
      if (!this.processedElements.has(element) && this.addDownloadButton(element, kind)) {
        this.processedElements.add(element);
      }
    });

    const latexCodeBlocks = document.querySelectorAll('.custom-code-block-container--latex');
    latexCodeBlocks.forEach(el => {
      const element = el as HTMLElement;
      if (!this.processedElements.has(element) && this.addLatexCodeDownloadButton(element)) {
        this.processedElements.add(element);
      }
    });
  }

  private extractLatexCode(element: HTMLElement): string | null {
    const copyText = element.getAttribute('copy-text') || element.getAttribute('data-custom-copy-text');
    if (!copyText) return null;

    let match = copyText.match(/\\\(([\s\S]*?)\\\)/);
    if (match) return match[1].trim();

    match = copyText.match(/\\\[([\s\S]*?)\\\]/);
    if (match) return match[1].trim();

    return copyText.trim();
  }

  private addDownloadButton(element: HTMLElement, _type: 'inline' | 'block'): boolean {
    if (element.querySelector('.dbx-latex-download-btn') || element.nextElementSibling?.classList.contains('dbx-latex-btn-container')) {
      return true;
    }

    const initialLatex = this.extractLatexCode(element);
    if (!initialLatex) return false;

    const btnContainer = document.createElement('span');
    btnContainer.className = 'dbx-latex-btn-container';
    btnContainer.style.cssText = 'display: inline-flex; align-items: center; margin-left: 6px; gap: 4px; vertical-align: middle;';

    const downloadBtn = document.createElement('span');
    downloadBtn.className = 'dbx-latex-download-btn';
    downloadBtn.innerHTML = DOWNLOAD_ICON_SVG;
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
      const liveLatex = this.extractLatexCode(element) || initialLatex;
      this.downloadLatex(liveLatex);
    });

    const copyBtn = document.createElement('span');
    copyBtn.className = 'dbx-latex-copy-btn';
    copyBtn.innerHTML = COPY_ICON_SVG;
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
    this.copyOriginalIcon.set(copyBtn, { html: COPY_ICON_SVG, color: '#888' });

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
      const liveLatex = this.extractLatexCode(element) || initialLatex;
      void this.copyToClipboard(liveLatex, copyBtn);
    });

    btnContainer.appendChild(downloadBtn);
    btnContainer.appendChild(copyBtn);

    if (element.parentNode) {
      const nextSibling = element.nextSibling;
      if (nextSibling) {
        element.parentNode.insertBefore(btnContainer, nextSibling);
      } else {
        element.parentNode.appendChild(btnContainer);
      }
      return true;
    }
    return false;
  }

  private addLatexCodeDownloadButton(element: HTMLElement): boolean {
    const existingBtn = element.querySelector('.dbx-latex-code-download-btn');
    if (existingBtn) return true;

    const codeArea = element.querySelector('code');
    if (!codeArea) return false;

    const initialCode = codeArea.textContent?.trim() || '';
    if (!initialCode) return false;

    const header = element.querySelector('.header-wrapper-Mbk8s6, .header-IAeXdE');
    if (!header) return false;

    const readLiveCode = () => element.querySelector('code')?.textContent?.trim() || initialCode;

    const btnContainer = document.createElement('span');
    btnContainer.className = 'dbx-latex-code-btn-container';
    btnContainer.style.cssText = 'display: inline-flex; align-items: center; margin-left: 8px; gap: 4px;';

    const downloadBtn = document.createElement('span');
    downloadBtn.className = 'dbx-latex-code-download-btn';
    downloadBtn.innerHTML = DOWNLOAD_ICON_SVG;
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
      this.downloadLatexCode(readLiveCode());
    });

    const copyBtn = document.createElement('span');
    copyBtn.className = 'dbx-latex-code-copy-btn';
    copyBtn.innerHTML = COPY_ICON_SVG;
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
    this.copyOriginalIcon.set(copyBtn, { html: COPY_ICON_SVG, color: '#666' });

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
      void this.copyToClipboard(readLiveCode(), copyBtn);
    });

    btnContainer.appendChild(downloadBtn);
    btnContainer.appendChild(copyBtn);

    const actionBar = element.querySelector('.action-ysQCxz');
    if (actionBar) {
      actionBar.appendChild(btnContainer);
    } else {
      header.appendChild(btnContainer);
    }
    return true;
  }

  private downloadLatex(latex: string): void {
    const content = this.wrapLatexDocument(latex, true);
    const filename = `formula_${Date.now()}.tex`;
    downloadFile(content, filename, 'text/plain');
  }

  private downloadLatexCode(code: string): void {
    const content = this.wrapLatexDocument(code, false);
    const filename = `latex_${Date.now()}.tex`;
    downloadFile(content, filename, 'text/plain');
  }

  private async copyToClipboard(text: string, btnElement: HTMLElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      const saved = this.copyOriginalIcon.get(btnElement) ?? {
        html: COPY_ICON_SVG,
        color: btnElement.style.color || '#666',
      };
      if (!this.copyOriginalIcon.has(btnElement)) {
        this.copyOriginalIcon.set(btnElement, saved);
      }

      const prevTimer = this.copyResetTimers.get(btnElement);
      if (prevTimer !== undefined) {
        clearTimeout(prevTimer);
      }

      btnElement.innerHTML = CHECK_ICON_SVG;
      btnElement.style.color = '#4CAF50';

      const timer = window.setTimeout(() => {
        btnElement.innerHTML = saved.html;
        btnElement.style.color = saved.color;
        this.copyResetTimers.delete(btnElement);
      }, 1500);
      this.copyResetTimers.set(btnElement, timer);
    } catch (err) {
      console.error('[LatexDownloader] Copy failed:', err);
    }
  }

  wrapLatexDocument(latex: string, isMathExpression = true): string {
    const trimmed = latex.trim();
    // Already a complete standalone LaTeX document — do not double-wrap.
    if (/\\documentclass\b/.test(trimmed)) {
      return `${trimmed}\n`;
    }

    const hasMathOrEnvDelimiters =
      /^(\\\[|\$\$|\$|\\begin\{|\\section\b|\\subsection\b|\\paragraph\b)/.test(trimmed);
    const body = isMathExpression && !hasMathOrEnvDelimiters
      ? `\\[\n${trimmed}\n\\]`
      : trimmed;

    return `% LaTeX Document
% Generated by Better Doubao
% Date: ${new Date().toLocaleString()}

\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amssymb}

\\begin{document}

${body}

\\end{document}
`;
  }

  destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.initialized = false;
  }
}

export const latexDownloader = new LatexDownloader();
