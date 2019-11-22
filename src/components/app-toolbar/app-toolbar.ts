import tippy, { createSingleton, Instance as TippyInstance } from 'tippy.js';
import { ToolbarMenuItemOptions } from './menu';
import { ToolbarMenuList } from './menu-list';
import {
  DataSourceManager,
  DataSourceManagerEvent
} from '../../model/datasource/manager';
import { DataSourceType } from '../../model/datasource/interfaces';
import { Stage, StageEvent } from '../../model/stage';
import { Trace } from '../../model/trace';
import SvgPlus from '!!raw-loader!@mdi/svg/svg/plus.svg';
import SvgDatabase from '!!raw-loader!@mdi/svg/svg/database.svg';
import SvgMagnify from '!!raw-loader!@mdi/svg/svg/magnify.svg';
import SvgSourceBranch from '!!raw-loader!@mdi/svg/svg/source-branch.svg';
import SvgWidgets from '!!raw-loader!@mdi/svg/svg/widgets.svg';
import SvgSettings from '!!raw-loader!@mdi/svg/svg/settings.svg';
import './app-toolbar.css';

export interface AppToolbarOptions {}

export type AppToolbarButtonType =
  | 'dataSources'
  | 'search'
  | 'traces'
  | 'widgets'
  | 'settings';

export type AppToolbarButtonState = 'selected' | 'disabled';

export class AppToolbar {
  private elements = {
    container: document.createElement('div'),
    btn: {
      dataSources: document.createElement('div'),
      search: document.createElement('div'),
      traces: document.createElement('div'),
      widgets: document.createElement('div'),
      settings: document.createElement('div')
    },
    tracesBadgeCount: document.createElement('div')
  };
  private tooltips: {
    singleton: TippyInstance;
    dataSources: TippyInstance;
    search: TippyInstance;
    traces: TippyInstance;
    widgets: TippyInstance;
    settings: TippyInstance;
  };
  private dropdowns: {
    dataSources: TippyInstance;
    traces: TippyInstance;
  };

  private binded = {
    onDataSourceManagerUpdate: this.onDataSourceManagerUpdate.bind(this),
    onDataSourceMenuListButtonClick: this.onDataSourceMenuListButtonClick.bind(
      this
    ),
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    onTracesMenuListButtonClick: this.onTracesMenuListButtonClick.bind(this)
  };

  private stage = Stage.getSingleton();
  private dsManager = DataSourceManager.getSingleton();

  private dataSourceMenuListHeaderEl = document.createElement('div');
  private dataSourcesMenuList = new ToolbarMenuList({
    headerEl: this.dataSourceMenuListHeaderEl,
    items: [],
    onButtonClick: this.binded.onDataSourceMenuListButtonClick
  });
  private tracesMenuList = new ToolbarMenuList({
    items: [],
    onButtonClick: this.binded.onTracesMenuListButtonClick
  });

  constructor(private options: AppToolbarOptions) {
    const { container: el, btn } = this.elements;
    el.classList.add('app-toolbar');

    // Panes
    const leftPane = document.createElement('div');
    leftPane.classList.add('app-toolbar-pane');
    el.appendChild(leftPane);

    const middlePane = document.createElement('div');
    middlePane.classList.add('app-toolbar-pane');
    el.appendChild(middlePane);

    const rightPane = document.createElement('div');
    rightPane.classList.add('app-toolbar-pane');
    el.appendChild(rightPane);

    // Left buttons
    btn.dataSources.classList.add('app-toolbar-button');
    btn.dataSources.innerHTML = SvgDatabase;
    leftPane.appendChild(btn.dataSources);

    btn.search.classList.add('app-toolbar-button', 'search');
    btn.search.innerHTML = SvgMagnify;
    leftPane.appendChild(btn.search);

    const divider = document.createElement('div');
    divider.classList.add('app-toolbar-divider');
    leftPane.appendChild(divider);

    btn.traces.classList.add('app-toolbar-button', 'traces');
    btn.traces.innerHTML = SvgSourceBranch;
    leftPane.appendChild(btn.traces);

    // Right buttons
    btn.widgets.classList.add('app-toolbar-button');
    btn.widgets.innerHTML = SvgWidgets;
    rightPane.appendChild(btn.widgets);

    btn.settings.classList.add('app-toolbar-button');
    btn.settings.innerHTML = SvgSettings;
    rightPane.appendChild(btn.settings);
  }

  init() {
    this.initTooltips();
    this.initDropdowns();
    this.initTracesBadgeCount();

    // Prepare dataSource menu list header
    this.dataSourceMenuListHeaderEl.classList.add(
      'toolbar-data-sources-menu-header'
    );

    const dsHeaderText = document.createElement('span');
    dsHeaderText.textContent = 'Data Sources';
    this.dataSourceMenuListHeaderEl.appendChild(dsHeaderText);

    const newDsButton = document.createElement('div');
    newDsButton.innerHTML = SvgPlus;
    this.dataSourceMenuListHeaderEl.appendChild(newDsButton);

    // Prepare datasource lists
    this.updateDataSourceList();

    // Bind events
    this.bindEvents();
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.elements.container);
  }

  unmount() {
    const el = this.elements.container;
    el.parentElement && el.parentElement.removeChild(el);
  }

  private initTooltips() {
    const tooltips = {
      dataSources: tippy(this.elements.btn.dataSources, {
        content: 'Data Sources',
        multiple: true
      }),
      search: tippy(this.elements.btn.search, { content: 'Search Traces' }),
      traces: tippy(this.elements.btn.traces, {
        content: 'Traces in the Stage',
        multiple: true
      }),
      widgets: tippy(this.elements.btn.widgets, {
        content: 'Widgets',
        multiple: true
      }),
      settings: tippy(this.elements.btn.settings, { content: 'Settings' })
    };

    const singleton = createSingleton(Object.values(tooltips), {
      delay: 1000,
      duration: 0,
      updateDuration: 0,
      theme: 'toolbar-tooltip'
    });

    this.tooltips = { ...tooltips, singleton };
  }

  private initDropdowns() {
    this.dropdowns = {
      dataSources: tippy(this.elements.btn.dataSources, {
        content: this.dataSourcesMenuList.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        duration: 0,
        updateDuration: 0,
        theme: 'toolbar-menu-list',
        trigger: 'click',
        interactive: true
      }),
      traces: tippy(this.elements.btn.traces, {
        content: this.tracesMenuList.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        duration: 0,
        updateDuration: 0,
        theme: 'toolbar-menu-list',
        trigger: 'click',
        interactive: true
      })
    };
  }

  private initTracesBadgeCount() {
    const el = this.elements.tracesBadgeCount;
    el.classList.add('toolbar-traces-badge-count');
  }

  //////////////////////////////////////
  //////////// VIEW UPDATES ////////////
  //////////////////////////////////////

  private updateDataSourceList() {
    this.dataSourcesMenuList.removeAllItems();
    this.dsManager.getAll().forEach(ds => {
      this.dataSourcesMenuList.addItem({
        text: ds.name,
        buttons:
          ds.type == DataSourceType.JAEGER || ds.type == DataSourceType.ZIPKIN
            ? [
                { id: 'search', icon: 'magnify' },
                { id: 'edit', icon: 'pencil' },
                { id: 'delete', icon: 'delete' }
              ]
            : [
                { id: 'add-to-stage', icon: 'plus' },
                { id: 'delete', icon: 'delete' }
              ]
      });
    });
  }

  private updateTracesList() {
    this.tracesMenuList.removeAllItems();
    const traces = this.stage.getAll();
    traces.forEach(trace => {
      this.tracesMenuList.addItem({
        text: trace.name,
        buttons: [{ id: 'remove', icon: 'close' }]
      });
    });
    this.updateTracesBadgeCount(traces.length);
  }

  updateTracesBadgeCount(count: number) {
    const el = this.elements.tracesBadgeCount;
    if (count > 0) {
      el.textContent = count + '';
      !el.parentElement && this.elements.btn.traces.appendChild(el);
    } else {
      el.parentElement && this.elements.btn.traces.removeChild(el);
    }
  }

  updateButtonSelection(
    type: AppToolbarButtonType,
    isSelected: boolean,
    style: 'background-fill' | 'svg-fill'
  ) {
    const el = this.elements.btn[type];
    if (!el) return;
    const className = {
      'background-fill': 'selected',
      'svg-fill': 'selected-fill'
    }[style];
    isSelected ? el.classList.add(className) : el.classList.remove(className);
  }

  ///////////////////////////////////////////////
  ////////////////// EVENTS /////////////////////
  ///////////////////////////////////////////////

  private bindEvents() {
    const { btn } = this.elements;
    this.dsManager.on(
      DataSourceManagerEvent.UPDATED,
      this.binded.onDataSourceManagerUpdate
    );
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
  }

  private unbindEvents() {
    const { btn } = this.elements;
    this.dsManager.removeListener(DataSourceManagerEvent.UPDATED, [
      this.binded.onDataSourceManagerUpdate
    ] as any);
    this.stage.removeListener(
      StageEvent.TRACE_ADDED,
      this.binded.onStageTraceAdded
    );
    this.stage.removeListener(
      StageEvent.TRACE_REMOVED,
      this.binded.onStageTraceRemoved
    );
  }

  private async onDataSourceMenuListButtonClick(
    buttonId: string,
    index: number
  ) {
    const ds = this.dsManager.getAll()[index];
    if (!ds) {
      console.error(`Data source not found at index: ${index}`);
      return;
    }

    switch (buttonId) {
      case 'add-to-stage': {
        const api = this.dsManager.apiFor(ds);
        const result = await api.search({} as any);
        const traces = result.data.map(spans => new Trace(spans));
        // Add all of the traces
        traces.forEach(trace => this.stage.add(trace));
        this.dropdowns.dataSources.hide();
        return;
      }

      default: {
        console.error(`Unknown data source menu list button id: "${buttonId}"`);
      }
    }
  }

  private onDataSourceManagerUpdate() {
    this.updateDataSourceList();
  }

  private onStageTraceAdded(trace: Trace) {
    this.updateTracesList();
  }

  private onStageTraceRemoved(trace: Trace) {
    this.updateTracesList();
  }

  private onTracesMenuListButtonClick(
    item: ToolbarMenuItemOptions,
    index: number
  ) {
    const trace = this.stage.getAll()[index];
    if (!trace) return;
    this.stage.remove(trace.id);
    this.dropdowns.traces.hide();
  }

  dispose() {
    const tippies = [].concat(
      Object.values(this.tooltips),
      Object.values(this.dropdowns)
    );
    for (let tippyIns of tippies) {
      tippyIns.destroy();
    }
    this.tooltips = null;
    this.dropdowns = null;
    this.unbindEvents();
    this.elements = null;
    this.options = null;
  }
}
