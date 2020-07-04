import { Modal, ModalEvent } from './modal';

let _singletonIns: ModalManager;

export class ModalManager {
  private modal: Modal;

  private binded = {
    onKeyDown: this.onKeyDown.bind(this),
  };

  static getSingleton() {
    if (!_singletonIns) _singletonIns = new ModalManager();
    return _singletonIns;
  }

  constructor() {
    document.addEventListener('keydown', this.binded.onKeyDown, false);
  }

  dispose() {
    document.removeEventListener('keydown', this.binded.onKeyDown, false);
  }

  private onKeyDown(e: KeyboardEvent) {
    // Handle just ESC
    if (e.which != 27) return;
    if (!this.modal) return;
    this.modal.handleEscKeyPress();
  }

  findModalFromElement(el: HTMLElement) {
    const modalEl = el.closest('[data-modal-id]');
    if (!modalEl) return;
    const id = modalEl.getAttribute('data-modal-id');
    if (!this.modal || this.modal.id != id) return;
    return this.modal;
  }

  show(modal: Modal) {
    if (this.modal) throw new Error(`Showing already a modal`);
    this.modal = modal;
    modal.on(ModalEvent.CLOSE, this.onModalClose.bind(this, modal));
    modal.mount();
    modal.setupFocusTrap();
  }

  private onModalClose(modal: Modal) {
    modal.removeFocusTrap();
    modal.unmount();
    modal.dispose(); // this will take care of unbinding `CLOSE` event
    this.modal = null;
  }
}
