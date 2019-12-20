import find from 'lodash/find';
import findIndex from 'lodash/findIndex';

import './widget-toolbar.css';
import './widget-toolbar-select.css';
import CodeSvgText from '!!raw-loader!@mdi/svg/svg/code-tags.svg';
import SettingsSvgText from '!!raw-loader!@mdi/svg/svg/settings-outline.svg';

export interface WidgetToolbarSelectOptions {
  width?: number;
  items: WidgetToolbarSelectItemOptions[];
  onSelect: (item: WidgetToolbarSelectItemOptions) => void;
}

export interface WidgetToolbarSelectItemOptions {
  type: 'item' | 'divider';
  id: string;
  text: string;
  icon?: 'code-tags' | 'settings-outline';
  disabled?: boolean;
}

interface WidgetToolbarSelectItem {
  options: WidgetToolbarSelectItemOptions;
  element: HTMLDivElement;
  onClickHandler?: (e: MouseEvent) => void;
}

export class WidgetToolbarSelect {
  readonly element = document.createElement('div');
  private items: WidgetToolbarSelectItem[] = [];
  private selectedItemId: string = null;

  constructor(private options: WidgetToolbarSelectOptions) {
    if (options.width) {
      this.element.style.width = `${options.width}px`;
    }

    options.items.forEach(options => {
      this.addItem(options);
    });
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

      el.innerHTML = `${iconHtml} ${textHtml} ${altTextHtml}`.trim();
      // Listen for click events
      const onClickHandler = this.onItemClick.bind(this, item);
      el.addEventListener('click', onClickHandler, false);
      (item as any).onClickHandler = onClickHandler;
    }

    this.element.appendChild(el);
    this.items.push(item);
  }

  removeItem(id: string) {
    const itemIndex = this.findItemIndex(item => item.id == id);
    if (itemIndex == -1) return false;
    const [removedItem] = this.items.splice(itemIndex, 1);
    this.element.removeChild(removedItem.element);
    if (removedItem.onClickHandler) {
      removedItem.element.removeEventListener(
        'click',
        removedItem.onClickHandler as any,
        false
      );
    }

    if (removedItem.options.id == this.selectedItemId) {
      this.selectedItemId = null;
    }
  }

  removeAllItems() {
    const items = this.items.slice();
    items.forEach(item => this.removeItem(item.options.id));
  }

  select(id: string) {
    if (this.selectedItemId == id) return true;
    const item = this.findItem(item => item.id == id);
    if (!item) return false;
    if (this.selectedItemId) this.unselect(this.selectedItemId);
    this.selectedItemId = item.options.id;
    item.element.classList.add('selected');
  }

  unselect(id: string) {
    const item = this.findItem(item => item.id == id);
    if (!item) return false;
    item.element.classList.remove('selected');
  }

  private onItemClick(item: WidgetToolbarSelectItem) {
    if (item.options.disabled) return false;
    const index = this.items.indexOf(item);
    if (index == -1) return false;
    this.options.onSelect(item.options);
  }

  private findItemIndex(
    predicate: (itemOptions: WidgetToolbarSelectItemOptions) => boolean
  ) {
    return findIndex(this.items, item => predicate(item.options));
  }

  private findItem(
    predicate: (itemOptions: WidgetToolbarSelectItemOptions) => boolean
  ) {
    return find(this.items, item => predicate(item.options));
  }
}
