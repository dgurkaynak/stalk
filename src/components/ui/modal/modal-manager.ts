import { Modal, ModalEvent } from './modal';

let _singletonIns: ModalManager;

export class ModalManager {
  private modals: Modal[] = [];

  private binded = {
    onKeyDown: this.onKeyDown.bind(this)
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
    if (e.which != 27) return;
    const activeModal = this.modals[this.modals.length - 1];
    if (!activeModal) return;
    activeModal.handleEscKeyPress();
  }

  findModalFromElement(el: HTMLElement) {
    const modalEl = el.closest('[data-modal-id]');
    if (!modalEl) return;
    const id = modalEl.getAttribute('data-modal-id');
    for (let modal of this.modals) {
      if (modal.id == id) return modal;
    }
  }

  show(modal: Modal) {
    this.modals.push(modal);
    modal.on(ModalEvent.CLOSE, this.onModalClose.bind(this, modal));
    modal.mount();
  }

  private onModalClose(modal: Modal) {
    modal.unmount();
    const i = this.modals.indexOf(modal);
    if (i > -1) this.modals.splice(i, 1);
    modal.dispose(); // this will take care of unbinding `CLOSE` event
  }
}
