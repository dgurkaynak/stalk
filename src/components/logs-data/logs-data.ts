import Handsontable from 'handsontable';
import tippy, { createSingleton, Instance as TippyInstance } from 'tippy.js';
import {
  WidgetToolbarMenu,
  WidgetToolbarMenuItemOptions
} from '../ui/widget-toolbar/widget-toolbar-menu';
import { Stage, StageEvent } from '../../model/stage';

import SvgMagnify from '!!raw-loader!@mdi/svg/svg/magnify.svg';
import 'handsontable/dist/handsontable.css';
import '../ui/widget-toolbar/widget-toolbar.css';
import './logs-data.css';

const TOOLBAR_HEIGHT = 27; // TODO: Sorry :(

export class LogsData {
  private stage = Stage.getSingleton();
  private hot: Handsontable;

  private elements = {
    container: document.createElement('div'),
    toolbar: document.createElement('div'),
    toolbarBtn: {
      search: document.createElement('div')
    },
    hotContainer: document.createElement('div')
  };
  private tooltips: {
    singleton: TippyInstance;
    search: TippyInstance;
  };

  constructor() {
    const { container, toolbar, hotContainer } = this.elements;
    container.classList.add('logs-data-view');
    container.appendChild(toolbar);
    container.appendChild(hotContainer);
    this.prepareToolbar();
  }

  private prepareToolbar() {
    const toolbarEl = this.elements.toolbar;
    const btn = this.elements.toolbarBtn;

    toolbarEl.classList.add('widget-toolbar', 'widget-toolbar');

    // Panes
    const leftPane = document.createElement('div');
    leftPane.classList.add('widget-toolbar-pane');
    toolbarEl.appendChild(leftPane);

    const middlePane = document.createElement('div');
    middlePane.classList.add('widget-toolbar-pane', 'middle');
    toolbarEl.appendChild(middlePane);

    const rightPane = document.createElement('div');
    rightPane.classList.add('widget-toolbar-pane', 'right');
    toolbarEl.appendChild(rightPane);

    // Buttons
    btn.search.classList.add('widget-toolbar-button');
    btn.search.innerHTML = SvgMagnify;
    leftPane.appendChild(btn.search);
  }

  init(options: { width: number; height: number }) {
    this.initTooltips();

    // asd
    this.hot = new Handsontable(this.elements.hotContainer, {
      width: options.width,
      height: options.height - TOOLBAR_HEIGHT,
      data: [
        ['', 'Ford', 'Tesla', 'Toyota', 'Honda'],
        ['2017', 10, 11, 12, 13],
        ['2018', 20, 11, 14, 13],
        ['2019', 30, 15, 12, 13],
        ['2017', 10, 11, 12, 13],
        ['2018', 20, 11, 14, 13],
        ['2019', 30, 15, 12, 13],
        ['2017', 10, 11, 12, 13],
        ['2018', 20, 11, 14, 13],
        ['2019', 30, 15, 12, 13],
        ['2017', 10, 11, 12, 13]
      ],
      readOnly: true,
      colHeaders: true,
      filters: true,
      dropdownMenu: true,
      licenseKey: 'non-commercial-and-evaluation'
    });
  }

  private initTooltips() {
    const btn = this.elements.toolbarBtn;
    const tooltips = {
      search: tippy(btn.search, {
        content: 'Seach',
        multiple: true
      })
    };

    const singleton = createSingleton(Object.values(tooltips), {
      delay: 1000,
      duration: 0,
      updateDuration: 0,
      theme: 'widget-toolbar-tooltip'
    });

    this.tooltips = { ...tooltips, singleton };
  }

  mount(parentEl: HTMLElement) {
    parentEl.appendChild(this.elements.container);
  }

  unmount() {
    const parent = this.elements.container.parentElement;
    parent && parent.removeChild(this.elements.container);
  }

  resize(width: number, height: number) {
    if (!this.hot) return;
    this.hot.updateSettings({
      width: width,
      height: height - TOOLBAR_HEIGHT
    });
    this.hot.render();
  }

  dispose() {
    // TODO:
  }
}
