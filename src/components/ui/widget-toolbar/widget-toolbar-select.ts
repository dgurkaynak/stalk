import './widget-toolbar.css';
import './widget-toolbar-select.css';
import CodeSvgText from '!!raw-loader!@mdi/svg/svg/code-tags.svg';
import SettingsSvgText from '!!raw-loader!@mdi/svg/svg/settings-outline.svg';
import findIndex from 'lodash/findIndex';

export interface WidgetToolbarSelectOptions {
  width?: number;
  items: WidgetToolbarSelectItemOptions[];
  onClick: (item: WidgetToolbarSelectItemOptions, index: number) => void;
}

export interface WidgetToolbarSelectItemOptions {
  type: WidgetToolbarMenuItemType;
  id?: string;
  text?: string;
  icon?: 'code-tags' | 'settings-outline';
  altText?: string;
  className?: string;
  disabled?: boolean;
}

export type WidgetToolbarMenuItemType = 'item' | 'divider';

export interface WidgetToolbarSelectItem {
  options: WidgetToolbarSelectItemOptions;
  element: HTMLDivElement;
  onClickHandler?: (e: MouseEvent) => void;
}

export class WidgetToolbarSelect {
  readonly element = document.createElement('div');
  private items: WidgetToolbarSelectItem[] = [];
  private selectedItemIndex = -1;

  constructor(private options: WidgetToolbarSelectOptions) {
    if (options.width) {
      this.element.style.width = `${options.width}px`;
    }

    options.items.forEach(options => {
      this.addItem(options);
    });
  }

  getItems() {
    return this.items.slice();
  }

  addItem(options: WidgetToolbarSelectItemOptions) {
    const el = document.createElement('div');
    const item = { element: el, options };

    if (options.type == 'divider') {
      el.classList.add('item-divider');
    } else {
      el.classList.add('item');
      options.disabled && el.classList.add('disabled');

      // Decorate
      let iconHtml = '';
      let textHtml = options.text;
      let altTextHtml = '';
      if (options.icon == 'code-tags') {
        iconHtml = CodeSvgText;
        textHtml = `<span class="text">${options.text}</span>`;
      } else if (options.icon == 'settings-outline') {
        iconHtml = SettingsSvgText;
        textHtml = `<span class="text">${options.text}</span>`;
      }
      if (options.altText) {
        altTextHtml = `<span class="alt">${options.altText}</span>`;
      }

      el.innerHTML = `${iconHtml} ${textHtml} ${altTextHtml}`.trim();
      // Listen for click events
      const onClickHandler = this.onItemClick.bind(this, item);
      el.addEventListener('click', onClickHandler, false);
      (item as any).onClickHandler = onClickHandler;
    }

    this.element.appendChild(el);
    this.items.push(item);
  }

  removeItemAt(index: number) {
    if (index >= this.items.length) return false;
    const currentSelectedItem = this.items[this.selectedItemIndex];
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

    if (currentSelectedItem) {
      this.selectedItemIndex = this.items.indexOf(currentSelectedItem);
      if (this.selectedItemIndex == -1) {
        // TODO: Currently selected item is removed, maybe do something?
      }
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

  selectAt(index: number, unselectOthers = true) {
    if (this.selectedItemIndex == index) return true;
    const item = this.items[index];
    if (!item) return false;
    if (unselectOthers) {
      this.unselectAt(this.selectedItemIndex);
    }
    this.selectedItemIndex = index;
    item.element.classList.add('selected');
  }

  unselectAt(index: number) {
    const item = this.items[index];
    if (!item) return false;
    item.element.classList.remove('selected');
  }

  onItemClick(item: WidgetToolbarSelectItem) {
    if (item.options.disabled) return false;
    const index = this.items.indexOf(item);
    if (index == -1) return false;
    this.options.onClick(item.options, index);
  }

  findIndex(predicate: (itemOptions: WidgetToolbarSelectItemOptions) => boolean) {
    return findIndex(this.items, item => predicate(item.options));
  }
}
