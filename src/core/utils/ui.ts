export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export function showToast(message: string, type: ToastType = 'info', durationMs = 2600): void {
  let container = document.getElementById('dbx-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dbx-toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `dbx-toast dbx-toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('dbx-toast--leaving');
    window.setTimeout(() => {
      toast.remove();
      if (container && container.childElementCount === 0) {
        container.remove();
      }
    }, 180);
  }, durationMs);
}

export function showConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dbx-popup dbx-confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.zIndex = '10020';

    const content = document.createElement('div');
    content.className = 'dbx-popup-content dbx-confirm-content';

    if (options.title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'dbx-popup-title';
      titleEl.textContent = options.title;
      content.appendChild(titleEl);
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'dbx-popup-message';
    messageEl.textContent = options.message;
    content.appendChild(messageEl);

    const actions = document.createElement('div');
    actions.className = 'dbx-popup-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'dbx-popup-btn dbx-popup-btn-cancel';
    cancelBtn.textContent = options.cancelText ?? '取消';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = `dbx-popup-btn ${options.danger ? 'dbx-popup-btn-danger' : 'dbx-popup-btn-confirm'}`;
    confirmBtn.textContent = options.confirmText ?? '确定';

    actions.append(cancelBtn, confirmBtn);
    content.appendChild(actions);
    overlay.appendChild(content);

    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
      resolve(result);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    };

    cancelBtn.addEventListener('click', () => finish(false));
    confirmBtn.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish(false);
    });
    document.addEventListener('keydown', onKeyDown, true);

    document.body.appendChild(overlay);
    confirmBtn.focus();
  });
}
