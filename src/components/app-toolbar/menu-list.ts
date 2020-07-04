import './menu-list.css';
import MagnifySvgText from '!!raw-loader!@mdi/svg/svg/magnify.svg';
import PencilSvgText from '!!raw-loader!@mdi/svg/svg/pencil.svg';
import DeleteSvgText from '!!raw-loader!@mdi/svg/svg/delete.svg';
import CloseSvgText from '!!raw-loader!@mdi/svg/svg/close.svg';
import PlusSvgText from '!!raw-loader!@mdi/svg/svg/plus.svg';

export interface ToolbarMenuListOptions {
  width?: number;
  items: ToolbarMenuListItemOptions[];
  onButtonClick: (buttonId: string, index: number) => void;
  onTextClick?: (index: number) => void;
  headerEl?: HTMLDivElement;
  emptyEl?: HTMLDivElement;
}

export interface ToolbarMenuListItemOptions {
  text: string;
  className?: string;
  buttons?: {
    id: string;
    icon: 'magnify' | 'pencil' | 'delete' | 'close' | 'plus';
  }[];
}

export interface ToolbarMenuListItem {
  options: ToolbarMenuListItemOptions;
  element: HTMLDivElement;
  onClickHandler?: (e: MouseEvent) => void;
}

export class ToolbarMenuList {
  readonly element = document.createElement('div');
  private items: ToolbarMenuListItem[] = [];

  constructor(private options: ToolbarMenuListOptions) {
    if (options.width) {
      this.element.style.width = `${options.width}px`;
    }

    options.headerEl && this.element.appendChild(options.headerEl);
    options.emptyEl && this.element.appendChild(options.emptyEl);

    options.items.forEach((options) => {
      this.addItem(options);
    });
  }

  getItems() {
    return this.items.slice();
  }

  addItem(options: ToolbarMenuListItemOptions) {
    if (this.options.emptyEl && this.options.emptyEl.parentElement) {
      this.options.emptyEl.parentElement.removeChild(this.options.emptyEl);
    }

    const el = document.createElement('div');
    const item = { element: el, options };

    el.classList.add('app-toolbar-menu-list-item');

    const textEl = document.createElement('span');
    textEl.classList.add('text');
    if (this.options.onTextClick) textEl.classList.add('clickable');
    textEl.textContent = options.text;
    el.appendChild(textEl);

    const buttonsContainer = document.createElement('div');
    el.appendChild(buttonsContainer);

    options.buttons.forEach((button) => {
      const buttonEl = document.createElement('div');
      buttonEl.classList.add('button');
      buttonEl.innerHTML = {
        magnify: MagnifySvgText,
        pencil: PencilSvgText,
        delete: DeleteSvgText,
        close: CloseSvgText,
        plus: PlusSvgText,
      }[button.icon];
      buttonEl.setAttribute('data-menu-list-button-id', button.id);
      buttonsContainer.appendChild(buttonEl);
    });

    const onClickHandler = this.onItemClick.bind(this, item);
    el.addEventListener('click', onClickHandler, false);
    (item as any).onClickHandler = onClickHandler;

    this.element.appendChild(el);
    this.items.push(item);
  }

  removeItemAt(index: number) {
    if (index >= this.items.length) return false;
    const [removedItem] = this.items.splice(index, 1);
    if (removedItem) {
      this.element.removeChild(removedItem.element);
      if (removedItem.onClickHandler) {
        removedItem.element.removeEventListener(
          'click',
          removedItem.onClickHandler as any,
          false
        );
      }
    }

    if (this.items.length == 0 && this.options.emptyEl) {
      this.element.appendChild(this.options.emptyEl);
    }
  }

  removeAllItems() {
    if (this.items.length == 0) return;
    let item = this.items[0];
    while (item) {
      this.removeItemAt(0);
      item = this.items[0];
    }
  }

  onItemClick(item: ToolbarMenuListItem, e: MouseEvent) {
    const index = this.items.indexOf(item);
    if (index == -1) return false;

    const targetEl = e.target as any;

    const textEl: HTMLDivElement = targetEl.closest('.text');
    if (textEl) {
      this.options.onTextClick?.(index);
      return;
    }

    const buttonEl: HTMLDivElement = targetEl.closest(
      '[data-menu-list-button-id]'
    );
    if (buttonEl) {
      const buttonId = buttonEl.getAttribute('data-menu-list-button-id');
      if (!buttonId) return;
      this.options.onButtonClick(buttonId, index);
    }
  }
}
