import Fuse from 'fuse.js';
import find from 'lodash/find';
import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';
import debounce from 'lodash/debounce';
import './widget-toolbar-multi-select.css';

export interface WidgetToolbarMultiSelectOptions {
  width?: number;
  maxHeight?: number;
  items: WidgetToolbarMultiSelectItemOptions[];
  showSearch?: boolean;
  onSelect: (item: WidgetToolbarMultiSelectItemOptions) => void;
  onUnselect: (item: WidgetToolbarMultiSelectItemOptions) => void;
  emptyMessage: string;
}

export interface WidgetToolbarMultiSelectItemOptions {
  id: string;
  text: string;
  category?: string;
  selected?: boolean;
  disabled?: boolean;
}

export class WidgetToolbarMultiSelect {
  private elements = {
    container: document.createElement('div'),
    itemsContainer: document.createElement('div'),
    searchInput: document.createElement('input')
  };

  private fuse: Fuse<
    WidgetToolbarMultiSelectItemOptions,
    Fuse.FuseOptions<WidgetToolbarMultiSelectItemOptions>
  >;

  private binded = {
    onSearchInput: debounce(this.onSearchInput.bind(this), 100),
    onItemContainerClick: this.onItemContainerClick.bind(this)
  };

  constructor(private options: WidgetToolbarMultiSelectOptions) {
    const els = this.elements;

    if (options.width) els.container.style.width = `${options.width}px`;

    els.searchInput.type = 'search';
    els.searchInput.classList.add('widget-toolbar-multi-select-search');
    els.searchInput.placeholder = 'Search...';
    els.searchInput.addEventListener('input', this.binded.onSearchInput, false);
    options.showSearch && els.container.appendChild(els.searchInput);

    if (options.maxHeight) {
      els.itemsContainer.style.overflowY = 'auto';
      els.itemsContainer.style.maxHeight = `${options.maxHeight}px`;
    }
    els.itemsContainer.classList.add('widget-toolbar-multi-select-items');
    els.container.appendChild(els.itemsContainer);

    this.fuse = new Fuse(options.items, { keys: ['id', 'text'] });
    this.render();

    // Bind events
    els.itemsContainer.addEventListener(
      'click',
      this.binded.onItemContainerClick,
      false
    );
  }

  get element() {
    return this.elements.container;
  }

  updateItems(newItems: WidgetToolbarMultiSelectItemOptions[]) {
    this.options.items = newItems;
    this.fuse = new Fuse(newItems, { keys: ['id', 'text'] });
    this.elements.searchInput.value = '';
    this.render();
  }

  render() {
    this.elements.itemsContainer.innerHTML = '';

    if (this.options.items.length == 0) {
      this.elements.itemsContainer.innerHTML = `<div class="empty">${this.options.emptyMessage}</div>`;
      return;
    }

    // If user is searching something, do not render category stuff -- just items
    const searchQuery = this.elements.searchInput.value.trim();
    if (searchQuery) {
      const results = this.fuse.search(searchQuery);
      if (results.length == 0) {
        this.elements.itemsContainer.innerHTML = `<div class="empty">No matches</div>`;
        return;
      }

      results.forEach((item: any) => {
        const itemElement = document.createElement('div');
        itemElement.setAttribute('data-item-id', item.id);
        itemElement.textContent = item.text;
        itemElement.classList.add('widget-toolbar-multi-select-item');
        if (item.selected) itemElement.classList.add('selected');
        if (item.disabled) itemElement.classList.add('disabled');
        this.elements.itemsContainer.appendChild(itemElement);
      });

      return;
    }

    // Render w/ category headers
    const itemsByCategories = groupBy(
      this.options.items,
      item => item.category || ''
    );
    const categories = Object.keys(itemsByCategories);
    categories.sort();

    categories.forEach(category => {
      if (category) {
        const categoryHeaderElement = document.createElement('div');
        categoryHeaderElement.classList.add(
          'widget-toolbar-multi-select-category'
        );
        categoryHeaderElement.textContent = category;
        this.elements.itemsContainer.appendChild(categoryHeaderElement);
      }

      const items = itemsByCategories[category];
      const itemsSorted = sortBy(items, item => item.text);
      itemsSorted.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.setAttribute('data-item-id', item.id);
        itemElement.textContent = item.text;
        itemElement.classList.add('widget-toolbar-multi-select-item');
        if (item.selected) itemElement.classList.add('selected');
        if (item.disabled) itemElement.classList.add('disabled');
        this.elements.itemsContainer.appendChild(itemElement);
      });
    });
  }

  select(id: string) {
    const item = find(this.options.items, item => item.id == id);
    if (!item) return false;
    if (item.disabled) return false;
    const itemEl = this.elements.itemsContainer.querySelector(
      `[data-item-id="${id}"]`
    );
    if (!itemEl) return false;
    item.selected = true;
    itemEl.classList.add('selected');
  }

  unselect(id: string) {
    const item = find(this.options.items, item => item.id == id);
    if (!item) return false;
    if (item.disabled) return false;
    const itemEl = this.elements.itemsContainer.querySelector(
      `[data-item-id="${id}"]`
    );
    if (!itemEl) return false;
    item.selected = false;
    itemEl.classList.remove('selected');
  }

  private onSearchInput(e: Event) {
    this.render();
  }

  private onItemContainerClick(e: MouseEvent) {
    const itemEl = (e.target as Element).closest('[data-item-id]');
    if (!itemEl) return;
    const itemId = itemEl.getAttribute('data-item-id');
    const item = find(this.options.items, item => item.id == itemId);
    if (!item) return;

    if (item.selected) {
      this.options.onUnselect && this.options.onUnselect(item);
    } else {
      this.options.onSelect && this.options.onSelect(item);
    }
  }

  dispose() {
    const els = this.elements;
    els.searchInput.removeEventListener(
      'input',
      this.binded.onSearchInput,
      false
    );
    els.itemsContainer.removeEventListener(
      'click',
      this.binded.onItemContainerClick,
      false
    );
  }
}
