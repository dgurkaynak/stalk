import Handsontable from 'handsontable';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import {
  WidgetToolbarMultiSelect,
  WidgetToolbarMultiSelectItem
} from '../ui/widget-toolbar/widget-toolbar-multi-select';
import { Stage, StageEvent } from '../../model/stage';
import { Trace } from '../../model/trace';
import map from 'lodash/map';
import prettyMilliseconds from 'pretty-ms';
import { TooltipManager } from '../ui/tooltip/tooltip-manager';
import { serviceNameOf } from '../../model/span-grouping/service-name';

import SvgMagnify from '!!raw-loader!@mdi/svg/svg/magnify.svg';
import SvgViewColumn from '!!raw-loader!@mdi/svg/svg/view-column.svg';
import 'handsontable/dist/handsontable.css';
import '../ui/widget-toolbar/widget-toolbar.css';
import './spans-data-view.css';

const TOOLBAR_HEIGHT = 27; // TODO: Sorry :(

export class SpansDataView {
  private stage = Stage.getSingleton();
  private hot: Handsontable;

  private elements = {
    container: document.createElement('div'),
    toolbar: document.createElement('div'),
    toolbarBtn: {
      search: document.createElement('div'),
      columns: document.createElement('div')
    },
    hotContainer: document.createElement('div')
  };
  private viewPropertiesCache = {
    width: 0,
    height: 0
  };

  private binded = {
    onTraceAdded: this.onTraceAdded.bind(this),
    onTraceRemoved: this.onTraceRemoved.bind(this),
    onColumnsMultiSelectSelect: this.onColumnsMultiSelectSelect.bind(this),
    onColumnsMultiSelectUnselect: this.onColumnsMultiSelectUnselect.bind(this),
    onColumnsMultiSelectSearchInput: this.onColumnsMultiSelectSearchInput.bind(
      this
    )
  };

  private dropdowns: {
    columnsSelection: TippyInstance;
  };
  private columnsMultiSelect = new WidgetToolbarMultiSelect({
    width: 200,
    maxItemContainerHeight: 125,
    showSearch: true,
    onSelect: this.binded.onColumnsMultiSelectSelect,
    onUnselect: this.binded.onColumnsMultiSelectUnselect,
    onSearchInput: this.binded.onColumnsMultiSelectSearchInput,
    items: [],
    emptyMessage: 'No Spans'
  });

  constructor() {
    const { container, toolbar, hotContainer } = this.elements;
    container.classList.add('spans-data-view');
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

    btn.columns.classList.add('widget-toolbar-button');
    btn.columns.innerHTML = SvgViewColumn;
    rightPane.appendChild(btn.columns);
  }

  init(options: { width: number; height: number }) {
    this.viewPropertiesCache = {
      width: options.width,
      height: options.height
    };
    this.initTooltips();
    this.initDropdowns();

    // Bind events
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onTraceRemoved);

    // Initially render hot
    this.updateHot();
  }

  private initTooltips() {
    const tooltipManager = TooltipManager.getSingleton();
    const btn = this.elements.toolbarBtn;
    tooltipManager.addToSingleton([
      [
        btn.search,
        {
          content: 'Search',
          multiple: true
        }
      ],
      [
        btn.columns,
        {
          content: 'Customize Columns',
          multiple: true
        }
      ]
    ]);
  }

  private initDropdowns() {
    this.dropdowns = {
      columnsSelection: tippy(this.elements.toolbarBtn.columns, {
        content: this.columnsMultiSelect.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        duration: 0,
        updateDuration: 0,
        theme: 'widget-toolbar-multi-select',
        trigger: 'click',
        interactive: true
      })
    };
  }

  private onTraceAdded(trace: Trace) {
    this.updateColumnsMultiSelectItems();
    this.updateHot();
  }

  private onTraceRemoved(trace: Trace) {
    this.updateColumnsMultiSelectItems();
    this.updateHot();
  }

  private updateColumnsMultiSelectItems() {
    if (this.stage.getAllTraces().length == 0) {
      this.columnsMultiSelect.updateItems([]);
      return;
    }

    const items: WidgetToolbarMultiSelectItem[] = [
      {
        id: 'operationName',
        text: 'Operation Name',
        selected: true
      },
      { id: 'id', text: 'Span Id' },
      { id: 'traceId', text: 'Trace Id' },
      { id: 'startTime', text: 'Start Time', selected: true },
      { id: 'finishTime', text: 'Finish Time' },
      { id: 'duration', text: 'Duration', selected: true },
      { id: 'selfTime', text: 'Self Time', selected: true },
      { id: 'serviceName', text: 'Service Name', selected: true },
      { id: 'tags', text: 'Tags', selected: true },
      { id: 'processTags', text: 'Process Tags' }
    ];

    Object.keys(this.stage.getAllSpanTags()).forEach(tag => {
      const selected = tag == 'error' ? true : false;
      items.push({
        id: `tag.${tag}`,
        text: `tag.${tag}`,
        category: 'Span Tags',
        selected
      });
    });

    Object.keys(this.stage.getAllProcessTags()).forEach(tag => {
      items.push({
        id: `process.tag.${tag}`,
        text: `process.tag.${tag}`,
        category: 'Process Tags'
      });
    });

    this.columnsMultiSelect.updateItems(items);
  }

  private updateHot() {
    this.hot && this.hot.destroy();
    this.hot = null;
    const spans = this.stage.getAllSpans();

    if (spans.length == 0) {
      this.elements.hotContainer.innerHTML = ``;
      return;
    }

    const stage = this.stage;
    const allSpanTags = this.stage.getAllSpanTags();
    const allProcessTags = this.stage.getAllProcessTags();
    const displayColumnItems = this.columnsMultiSelect.getSelectedItems();
    const displayedColumnIds = displayColumnItems.map(i => i.id);
    const columns: Handsontable.ColumnSettings[] = [];

    if (displayedColumnIds.indexOf('startTime') > -1) {
      columns.push({
        header: 'Start Time',
        columnMeta: {
          data: 'startTime',
          renderer: this.prepareHotTimestampRenderer()
        }
      });
    }

    if (displayedColumnIds.indexOf('finishTime') > -1) {
      columns.push({
        header: 'Finish Time',
        columnMeta: {
          data: 'finishTime',
          renderer: this.prepareHotTimestampRenderer()
        }
      });
    }

    if (displayedColumnIds.indexOf('duration') > -1) {
      columns.push({
        header: 'Duration',
        columnMeta: {
          data: function(row: any) {
            return row.finishTime - row.startTime;
          },
          renderer: this.prepareHotDurationRenderer()
        }
      });
    }

    if (displayedColumnIds.indexOf('selfTime') > -1) {
      columns.push({
        header: 'Self Time',
        columnMeta: {
          data: function(row: any) {
            return stage.getSpanSelfTime(row.id);
          },
          renderer: this.prepareHotDurationRenderer()
        }
      });
    }

    if (displayedColumnIds.indexOf('operationName') > -1) {
      columns.push({
        header: 'Operation Name',
        columnMeta: { data: 'operationName' }
      });
    }

    if (displayedColumnIds.indexOf('serviceName') > -1) {
      columns.push({
        header: 'Service Name',
        columnMeta: {
          data: function(row: any) {
            return serviceNameOf(row);
          }
        }
      });
    }

    if (displayedColumnIds.indexOf('id') > -1) {
      columns.push({
        header: 'Span Id',
        columnMeta: { data: 'id' }
      });
    }

    if (displayedColumnIds.indexOf('traceId') > -1) {
      columns.push({
        header: 'Trace Id',
        columnMeta: { data: 'traceId' }
      });
    }

    // Handle displayed tags
    const displayedTagKeys: string[] = [];
    displayedColumnIds.forEach(columnId => {
      if (columnId.indexOf('tag.') != 0) return;
      displayedTagKeys.push(columnId.replace('tag.', ''));
    });
    displayedTagKeys.forEach(tagKey => {
      columns.push({
        header: `tags.${tagKey}`,
        columnMeta: {
          data: function(row: any) {
            return row.tags[tagKey];
          }
        }
      });
    });

    // Handle displayed process tags
    const displayedProcessTagKeys: string[] = [];
    displayedColumnIds.forEach(columnId => {
      if (columnId.indexOf('process.tag.') != 0) return;
      displayedProcessTagKeys.push(columnId.replace('process.tag.', ''));
    });
    displayedProcessTagKeys.forEach(tagKey => {
      columns.push({
        header: `process.tags.${tagKey}`,
        columnMeta: {
          data: function(row: any) {
            if (!row.process || !row.process.tags) return;
            return row.process.tags[tagKey];
          }
        }
      });
    });

    // Handle other tags
    if (displayedColumnIds.indexOf('tags') > -1) {
      columns.push({
        header: 'Tags',
        columnMeta: {
          data: function(row: any) {
            const otherTags: [string, any][] = [];
            Object.keys(allSpanTags).forEach((key: string) => {
              if (!row.tags.hasOwnProperty(key)) return;
              if (displayedTagKeys.indexOf(key) > -1) return; // Already has a seperate column
              otherTags.push([key, row.tags[key]]);
            });
            return otherTags;
          },
          renderer: this.prepareHotKeyValuePairRenderer()
        } as any
      });
    }

    // Handle other process tags
    if (displayedColumnIds.indexOf('processTags') > -1) {
      columns.push({
        header: 'Process Tags',
        columnMeta: {
          data: function(row: any) {
            const otherTags: [string, any][] = [];
            Object.keys(allProcessTags).forEach((key: string) => {
              if (!row.process || !row.process.tags) return;
              if (!row.process.tags.hasOwnProperty(key)) return;
              if (displayedProcessTagKeys.indexOf(key) > -1) return; // Already has a seperate column
              otherTags.push([key, row.process.tags[key]]);
            });
            return otherTags;
          },
          renderer: this.prepareHotKeyValuePairRenderer()
        } as any
      });
    }

    this.hot = new Handsontable(this.elements.hotContainer, {
      width: this.viewPropertiesCache.width,
      height: this.viewPropertiesCache.height - TOOLBAR_HEIGHT,
      data: spans,
      colHeaders: columns.map(c => c.header),
      columns: columns.map(c => c.columnMeta),
      readOnly: true,
      // filters: true,
      // dropdownMenu: [
      //   'filter_by_condition',
      //   'filter_by_value',
      //   'filter_action_bar'
      // ],
      licenseKey: 'non-commercial-and-evaluation',
      manualColumnResize: true,
      manualColumnMove: true,
      // manualColumnFreeze: true,
      // disableVisualSelection: true,
      contextMenu: [
        'alignment',
        // 'freeze_column',
        // 'unfreeze_column',
        '---------',
        'copy'
      ],
      columnSorting: {
        sortEmptyCells: true,
        initialConfig: {
          column: 0,
          sortOrder: 'asc'
        }
      },
      currentRowClassName: 'spans-data-view-currentRow',
      stretchH: 'last'
    });
  }

  private prepareHotTimestampRenderer() {
    const stageStartTimestamp = this.stage.startTimestamp;
    return function(
      instance: Handsontable,
      td: HTMLTableDataCellElement,
      row: number,
      col: number,
      prop: string,
      value: number,
      cellProperties: Handsontable.CellProperties
    ) {
      const time = prettyMilliseconds((value - stageStartTimestamp) / 1000, {
        formatSubMilliseconds: true
      });
      Handsontable.renderers.TextRenderer.call(
        this,
        instance,
        td,
        row,
        col,
        prop,
        time,
        cellProperties
      );
      return td;
    };
  }

  private prepareHotDurationRenderer() {
    return function(
      instance: Handsontable,
      td: HTMLTableDataCellElement,
      row: number,
      col: number,
      prop: string,
      value: number,
      cellProperties: Handsontable.CellProperties
    ) {
      const time = prettyMilliseconds(value / 1000, {
        formatSubMilliseconds: true
      });
      Handsontable.renderers.TextRenderer.call(
        this,
        instance,
        td,
        row,
        col,
        prop,
        time,
        cellProperties
      );
      return td;
    };
  }

  private prepareHotKeyValuePairRenderer() {
    return function(
      instance: Handsontable,
      td: HTMLTableDataCellElement,
      row: number,
      col: number,
      prop: string,
      value: [string, any][],
      cellProperties: Handsontable.CellProperties
    ) {
      // Handsontable adds `htDimmed` class when the cell is not editable
      td.classList.add('htDimmed', 'spans-data-view-other-field');

      // When re-using cell, empty it
      td.innerHTML = '';

      // Add custom elements
      value.forEach(([key, value_]) => {
        const keyEl = document.createElement('span');
        keyEl.classList.add('spans-data-view-other-field-key');
        keyEl.textContent = `${key}:`;
        td.appendChild(keyEl);

        const valueEl = document.createElement('span');
        valueEl.classList.add('spans-data-view-other-field-value');
        valueEl.textContent = value_;
        td.appendChild(valueEl);
      });

      return td;
    };
  }

  private onColumnsMultiSelectSelect(item: WidgetToolbarMultiSelectItem) {
    this.columnsMultiSelect.select(item.id);
    this.updateHot();
  }

  private onColumnsMultiSelectUnselect(item: WidgetToolbarMultiSelectItem) {
    this.columnsMultiSelect.unselect(item.id);
    this.updateHot();
  }

  private onColumnsMultiSelectSearchInput() {
    // Probably height of the multi-select is changed,
    // if tippy is forced to render top position, this breaks the
    // arrow positioning. This is a workaround for updating its
    // position again
    this.dropdowns.columnsSelection.popperInstance.update();
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
    this.hot && this.hot.destroy();
    this.hot = null;

    this.stage.removeListener(StageEvent.TRACE_ADDED, this.binded.onTraceAdded);
    this.stage.removeListener(
      StageEvent.TRACE_ADDED,
      this.binded.onTraceRemoved
    );

    const tooltipManager = TooltipManager.getSingleton();
    const btn = this.elements.toolbarBtn;
    tooltipManager.removeFromSingleton([btn.search, btn.columns]);

    for (let tippy of Object.values(this.dropdowns)) {
      tippy.destroy();
    }
    this.dropdowns = null;
  }
}
