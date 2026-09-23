/* Accessible modal built on the native <dialog> element: focus is trapped,
 * Escape closes it, the page behind becomes inert, and focus returns to the
 * button that opened it. */
import { icon } from './icons.js';

let counter = 0;

/**
 * @param {object} opts
 * @param {string} opts.title        Heading text (plain text).
 * @param {string} [opts.eyebrow]    Small label above the title (plain text).
 * @param {string|Node} opts.body    HTML string or a DOM node.
 * @param {string} [opts.accent]     CSS color for the top accent bar.
 * @param {HTMLElement} [opts.returnFocus] Where focus goes on close (defaults to the opener).
 * @returns {{ dialog: HTMLDialogElement, close: () => void }}
 */
export function openModal({ title, eyebrow = '', body, accent = '', returnFocus }) {
  const opener = returnFocus || document.activeElement;
  const id = `modal-title-${++counter}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.setAttribute('aria-labelledby', id);
  if (accent) dialog.style.setProperty('--modal-accent', accent);
  dialog.innerHTML = `
    <div class="modal__inner">
      <header class="modal__header">
        <div>
          ${eyebrow ? '<p class="modal__eyebrow mono"></p>' : ''}
          <h2 class="modal__title" id="${id}"></h2>
        </div>
        <button type="button" class="icon-btn modal__close" aria-label="Close">${icon('x')}</button>
      </header>
      <div class="modal__body"></div>
    </div>`;
  dialog.querySelector('.modal__title').textContent = title;
  if (eyebrow) dialog.querySelector('.modal__eyebrow').textContent = eyebrow;
  const bodyEl = dialog.querySelector('.modal__body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.append(body);

  const close = () => dialog.open && dialog.close();
  dialog.querySelector('.modal__close').addEventListener('click', close);
  // Click on the backdrop (outside the inner panel) closes the dialog.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    // Another modal may have opened in the meantime (e.g. day list → event).
    if (document.querySelector('dialog.modal[open]')) return;
    document.body.classList.remove('modal-open');
    if (opener && typeof opener.focus === 'function' && opener.isConnected) opener.focus();
  });

  document.body.append(dialog);
  document.body.classList.add('modal-open');
  dialog.showModal();
  dialog.querySelector('.modal__close').focus();
  return { dialog, close };
}
