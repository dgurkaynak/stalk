import * as shortid from 'shortid';
import EventEmitterExtra from 'event-emitter-extra';

export interface ModalOptions {
  content: HTMLElement;
  shouldCloseOnOverlayClick?: boolean;
  shouldCloseOnEscPress?: boolean;
  contentContainerClassName?: string;
  onClose?: (triggerType: ModalCloseTriggerType, data: any) => void;
}

export enum ModalCloseTriggerType {
  ESC_KEY = 'esc-key',
  OVERLAY_CLICK = 'overlay-click',
  CLOSE_METHOD_CALL = 'close-method-call'
}

export enum ModalEvent {
  CLOSE = 'close'
}

export class Modal extends EventEmitterExtra {
  readonly id = shortid.generate();
  readonly container = document.createElement('div');
  private contentContainer = document.createElement('div');

  private binded = {
    onContainerClick: this.onContainerClick.bind(this),
    onContentContainerClick: this.onContentContainerClick.bind(this)
  };

  constructor(readonly options: ModalOptions) {
    super();

    // Container
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.right = '0';
    this.container.style.bottom = '0';
    this.container.style.background = 'rgba(0, 0, 0, 0.6)';
    this.container.style.display = 'flex';
    this.container.style.justifyContent = 'center';
    this.container.style.alignItems = 'center';
    this.container.setAttribute('data-modal-id', this.id);

    // Content container
    this.contentContainer.style.background = '#fff';
    this.contentContainer.style.borderRadius = '4px';
    if (options.contentContainerClassName) {
      this.contentContainer.classList.add(options.contentContainerClassName);
    }
    this.contentContainer.appendChild(options.content);
    this.container.appendChild(this.contentContainer);

    // Bind click event if necessary
    if (this.options.shouldCloseOnOverlayClick) {
      this.contentContainer.addEventListener(
        'click',
        this.binded.onContentContainerClick,
        false
      );
      this.container.addEventListener(
        'click',
        this.binded.onContainerClick,
        false
      );
    }
  }

  mount() {
    document.body.appendChild(this.container);
  }

  unmount() {
    document.body.removeChild(this.container);
  }

  private onContainerClick(e: MouseEvent) {
    if (!this.options.shouldCloseOnOverlayClick) return;
    this.close({
      triggerType: ModalCloseTriggerType.OVERLAY_CLICK
    });
  }

  handleEscKeyPress() {
    if (!this.options.shouldCloseOnEscPress) return;
    this.close({
      triggerType: ModalCloseTriggerType.ESC_KEY
    });
  }

  private onContentContainerClick(e: MouseEvent) {
    // If clicked on content, stop propagation, so that
    e.stopPropagation();
  }

  close(options?: { triggerType?: ModalCloseTriggerType; data?: any }) {
    const { onClose } = this.options;
    if (onClose) {
      options = options || {};
      onClose(
        options.triggerType || ModalCloseTriggerType.CLOSE_METHOD_CALL,
        options.data
      );
    }
    this.emit(ModalEvent.CLOSE);
  }

  dispose() {
    this.contentContainer.removeEventListener(
      'click',
      this.binded.onContentContainerClick,
      false
    );
    this.container.removeEventListener(
      'click',
      this.binded.onContainerClick,
      false
    );
    this.removeAllListeners();
  }
}
