import tippy, { Instance as TippyInstance } from 'tippy.js';
import {
  WidgetToolbarSelect,
  WidgetToolbarSelectItem
} from '../widget-toolbar/widget-toolbar-select';
import { find } from 'lodash';

import '../context-menu/context-menu.css';

let _singletonIns: ContextMenuManager;

export class ContextMenuManager {
  private tippy: TippyInstance;
  private _isShowing = false;
  get isShowing() { return this._isShowing; }

  private binded = {
    onMenuItemClick: this.onMenuItemClick.bind(this)
  };

  private menuItems: {
    selectItem: WidgetToolbarSelectItem;
    onSelected?: () => void;
  }[] = [];
  private menu = new WidgetToolbarSelect({
    // width: 150,
    items: [],
    onSelect: this.binded.onMenuItemClick
  });

  static getSingleton() {
    if (!_singletonIns) _singletonIns = new ContextMenuManager();
    return _singletonIns;
  }

  init() {
    this.tippy = tippy(document.body, {
      lazy: false,
      interactive: true,
      duration: 0,
      updateDuration: 0,
      trigger: 'custom',
      arrow: false,
      content: this.menu.element,
      multiple: true,
      placement: 'bottom-start',
      theme: 'context-menu',
      onCreate(instance) {
        instance.popperInstance.reference = {
          clientWidth: 0,
          clientHeight: 0,
          getBoundingClientRect() {
            return {
              width: 0,
              height: 0,
              top: 0,
              bottom: 0,
              left: 0,
              right: 0
            };
          }
        };
      },
      onShow: () => { this._isShowing = true; },
      onHide: () => { this._isShowing = false; }
    });
  }

  show(options: {
    x: number;
    y: number;
    menuItems: {
      selectItem: WidgetToolbarSelectItem;
      onSelected?: () => void;
    }[];
  }) {
    this.menuItems = options.menuItems;
    this.menu.updateItems(options.menuItems.map(i => i.selectItem));

    Object.assign(this.tippy.popperInstance.reference, {
      clientWidth: 0,
      clientHeight: 0,
      getBoundingClientRect: () => {
        return {
          width: 0,
          height: 0,
          top: options.y,
          bottom: options.y,
          left: options.x,
          right: options.x
        };
      }
    });
    this.tippy.popperInstance.update();
    this.tippy.show();
  }

  hide() {
    this.tippy.hide();
  }

  private onMenuItemClick(item: WidgetToolbarSelectItem) {
    if (item.type == 'divider') return;
    if (item.disabled) return;

    const menuItem = find(
      this.menuItems,
      i => (i.selectItem as any).id == item.id
    );
    if (menuItem) {
      menuItem.onSelected && menuItem.onSelected();
      this.hide();
    } else {
      this.hide();
    }
  }

  dispose() {
    this.tippy.destroy();
    this.menuItems = [];
    this.menu.dispose();
  }
}
