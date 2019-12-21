import find from 'lodash/find';
import findIndex from 'lodash/findIndex';

import './widget-toolbar.css';
import './widget-toolbar-select.css';
import CodeSvgText from '!!raw-loader!@mdi/svg/svg/code-tags.svg';
import SettingsSvgText from '!!raw-loader!@mdi/svg/svg/settings-outline.svg';

export interface WidgetToolbarSelectOptions {
  width?: number;
  items: WidgetToolbarSelectItem[];
  onSelect: (item: WidgetToolbarSelectItem) => void;
}

export type WidgetToolbarSelectItem =
  | {
      type: 'item';
      id: string;
      text: string;
      icon?: 'code-tags' | 'settings-outline';
      disabled?: boolean;
    }
  | { type: 'divider' };

export class WidgetToolbarSelect {
  readonly element = document.createElement('div');
  private selectedItemId: string = null;

  private binded = {
    onClick: this.onClick.bind(this)
  };

  constructor(private options: WidgetToolbarSelectOptions) {
    if (options.width) {
      this.element.style.width = `${options.width}px`;
    }

    this.element.addEventListener('click', this.binded.onClick, false);
    this.render();
  }

  // updateItems(newItems: WidgetToolbarSelectItemOptions) {
  //   // We don't need it for now
  // }

  render() {
    this.element.innerHTML = '';

    this.options.items.forEach(item => {
      const el = document.createElement('div');

      // Divider
      if (item.type == 'divider') {
        el.classList.add('item-divider');
        this.element.appendChild(el);
        return;
      }

      // Normal item
      el.classList.add('item');
      item.disabled && el.classList.add('disabled');

      // Decorate
      let iconHtml = '';
      let textHtml = item.text;
      let altTextHtml = '';
      if (item.icon == 'code-tags') {
        iconHtml = CodeSvgText;
        textHtml = `<span class="text">${item.text}</span>`;
      } else if (item.icon == 'settings-outline') {
        iconHtml = SettingsSvgText;
        textHtml = `<span class="text">${item.text}</span>`;
      }

      el.innerHTML = `${iconHtml} ${textHtml} ${altTextHtml}`.trim();
      el.setAttribute('data-item-id', item.id);
      this.element.appendChild(el);
    });
  }

  select(id: string) {
    const item = find(this.options.items, item => (item as any).id == id);
    if (!item) return false;
    if (item.type == 'divider') return false;
    if (item.disabled) return false;
    const itemEl = this.element.querySelector(`[data-item-id="${id}"]`);
    if (!itemEl) return false;

    // Unselect the previous one
    if (this.selectedItemId) {
      const currentSelectedItem = this.element.querySelector(
        `[data-item-id="${this.selectedItemId}"]`
      );
      currentSelectedItem && currentSelectedItem.classList.remove('selected');
    }

    this.selectedItemId = item.id;
    itemEl.classList.add('selected');
  }

  private onClick(e: MouseEvent) {
    const itemEl = (e.target as Element).closest('[data-item-id]');
    if (!itemEl) return;
    const itemId = itemEl.getAttribute('data-item-id');
    const item = find(this.options.items, item => (item as any).id == itemId);
    if (!item) return;
    if (item.type == 'divider') return;
    if (item.disabled) return;
    this.options.onSelect && this.options.onSelect(item);
  }

  dispose() {
    this.element.removeEventListener('click', this.binded.onClick, false);
    this.selectedItemId = null;
  }
}
