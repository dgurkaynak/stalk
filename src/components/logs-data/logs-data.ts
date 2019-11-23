import Handsontable from 'handsontable';
import tippy, { createSingleton, Instance as TippyInstance } from 'tippy.js';
import {
  WidgetToolbarMenu,
  WidgetToolbarMenuItemOptions
} from '../ui/widget-toolbar/widget-toolbar-menu';
import { Stage, StageEvent } from '../../model/stage';
import { Trace } from '../../model/trace';
import map from 'lodash/map';

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
  private viewPropertiesCache = {
    width: 0,
    height: 0
  };

  private binded = {
    onTraceAdded: this.onTraceAdded.bind(this),
    onTraceRemoved: this.onTraceRemoved.bind(this)
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
    this.viewPropertiesCache = {
      width: options.width,
      height: options.height
    };
    this.initTooltips();

    // Bind events
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onTraceRemoved);

    // Initially render hot
    this.updateHot();
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

  private onTraceAdded(trace: Trace) {
    this.updateHot();
  }

  private onTraceRemoved(trace: Trace) {
    this.updateHot();
  }

  private updateHot() {
    this.hot && this.hot.destroy();
    this.hot = null;
    const logs = this.stage.getAllLogs();

    if (logs.length == 0) {
      this.elements.hotContainer.innerHTML = ``;
    } else {
      const logFieldKeys = this.stage.getAllLogFieldKeys();
      const logFieldKeysSorted = map(logFieldKeys, (count, key) => [key, count]).sort((a, b) => {
        return (b[1] as number) - (a[1] as number);
      });
      const columns = [
        { header: 'Timestamp', columnMeta: { data: 'timestamp' } },
        { header: 'Span', columnMeta: { data: 'span.operationName' } },
        ...logFieldKeysSorted.map(([key]) => {
          return {
            header: key as string,
            columnMeta: { data: `fields.${key}` }
          };
        })
      ]

      this.hot = new Handsontable(this.elements.hotContainer, {
        width: this.viewPropertiesCache.width,
        height: this.viewPropertiesCache.height - TOOLBAR_HEIGHT,
        data: logs,
        colHeaders: columns.map(c => c.header),
        columns: columns.map(c => c.columnMeta),
        readOnly: true,
        filters: true,
        dropdownMenu: [
          'alignment',
          '---------',
          'filter_by_condition',
          'filter_by_value',
          'filter_action_bar',
        ],
        licenseKey: 'non-commercial-and-evaluation',
        manualColumnResize: true,
        manualColumnMove: true,
      });
    }
  }

  mount(parentEl: HTMLElement) {
    parentEl.appendChild(this.elements.container);
  }

  unmount() {
    const parent = this.elements.container.parentElement;
    parent && parent.removeChild(this.elements.container);
  }

  resize(width: number, height: number) {
    this.viewPropertiesCache = { width, height };
    if (!this.hot) return;
    this.hot.updateSettings({
      width: width,
      height: height - TOOLBAR_HEIGHT
    });
    this.hot.render();
  }

  dispose() {
    // TODO:
    this.stage.removeListener(StageEvent.TRACE_ADDED, this.binded.onTraceAdded);
    this.stage.removeListener(
      StageEvent.TRACE_ADDED,
      this.binded.onTraceRemoved
    );
  }
}
