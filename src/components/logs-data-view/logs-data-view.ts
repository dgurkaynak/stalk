import Handsontable from 'handsontable';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import {
  WidgetToolbarMultiSelect,
  WidgetToolbarMultiSelectItemOptions
} from '../ui/widget-toolbar/widget-toolbar-multi-select';
import { Stage, StageEvent } from '../../model/stage';
import { Trace } from '../../model/trace';
import map from 'lodash/map';
import prettyMilliseconds from 'pretty-ms';
import { TooltipManager } from '../ui/tooltip/tooltip-manager';

import SvgMagnify from '!!raw-loader!@mdi/svg/svg/magnify.svg';
import SvgViewColumn from '!!raw-loader!@mdi/svg/svg/view-column.svg';
import 'handsontable/dist/handsontable.css';
import '../ui/widget-toolbar/widget-toolbar.css';
import './logs-data-view.css';

const TOOLBAR_HEIGHT = 27; // TODO: Sorry :(

export class LogsDataView {
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
    emptyMessage: 'No Logs'
  });

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

    const spanColumns: WidgetToolbarMultiSelectItemOptions[] = [
      {
        id: 'span.operationName',
        text: 'span.operationName',
        category: 'Span',
        selected: true
      },
      { id: 'span.id', text: 'span.id', category: 'Span' },
      { id: 'span.traceId', text: 'span.traceId', category: 'Span' }
    ];
    const logFields = this.determineInitialLogFieldColumns();
    const logColumns: WidgetToolbarMultiSelectItemOptions[] = [].concat(
      logFields.display.map(f => ({
        id: `fields.${f}`,
        text: `fields.${f}`,
        category: 'Log Field',
        selected: true
      })),
      logFields.hidden.map(f => ({
        id: `fields.${f}`,
        text: `fields.${f}`,
        category: 'Log Field'
      }))
    );
    const allColumnds = [].concat(spanColumns, logColumns);
    this.columnsMultiSelect.updateItems(allColumnds);
  }

  private determineInitialLogFieldColumns() {
    const totalLogCount = this.stage.getAllLogs().length;
    const logFieldKeys = this.stage.getAllLogFieldKeys();
    const logFieldKeysSorted = map(logFieldKeys, (count, key) => [
      key,
      count / totalLogCount // usage ratio
    ]).sort((a, b) => {
      return (b[1] as number) - (a[1] as number);
    });
    const displayedLogFieldKeys: string[] = [];
    const otherLogFieldKeys: string[] = [];
    logFieldKeysSorted.forEach(([key, ratio]) => {
      if (ratio > 0.9) {
        displayedLogFieldKeys.push(key as string);
      } else {
        otherLogFieldKeys.push(key as string);
      }
    });
    return {
      display: displayedLogFieldKeys,
      hidden: otherLogFieldKeys,
      all: [].concat(displayedLogFieldKeys, otherLogFieldKeys)
    };
  }

  private updateHot() {
    this.hot && this.hot.destroy();
    this.hot = null;
    const logs = this.stage.getAllLogs();

    if (logs.length == 0) {
      this.elements.hotContainer.innerHTML = ``;
      return;
    }

    const allLogFields = this.determineInitialLogFieldColumns().all;
    const displayColumnItems = this.columnsMultiSelect.getSelectedItems();
    const displayedColumnIds = displayColumnItems.map(i => i.id);

    const columns = [
      {
        header: 'Timestamp',
        columnMeta: {
          data: 'timestamp',
          renderer: this.prepareHotTimestampRenderer()
        }
      },
      ...displayColumnItems.map(item => {
        return {
          header: item.text,
          columnMeta: { data: item.id }
        };
      }),
      {
        header: 'Log Fields',
        columnMeta: {
          data: function(row: any) {
            const otherFields: [string, any][] = [];
            allLogFields.forEach(key => {
              if (!row.fields.hasOwnProperty(key)) return;
              if (displayedColumnIds.indexOf(`fields.${key}`) > -1) return; // Already has a seperate column
              otherFields.push([key, row.fields[key]]);
            });
            return otherFields;
          },
          renderer: this.prepareHotOtherFieldsRenderer()
        } as any
      }
    ];

    this.hot = new Handsontable(this.elements.hotContainer, {
      width: this.viewPropertiesCache.width,
      height: this.viewPropertiesCache.height - TOOLBAR_HEIGHT,
      data: logs,
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
      currentRowClassName: 'logs-data-view-currentRow',
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

  private prepareHotOtherFieldsRenderer() {
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
      td.classList.add('htDimmed', 'logs-data-view-other-field');

      // When re-using cell, empty it
      td.innerHTML = '';

      // Add custom elements
      value.forEach(([key, value_]) => {
        const keyEl = document.createElement('span');
        keyEl.classList.add('logs-data-view-other-field-key');
        keyEl.textContent = `${key}:`;
        td.appendChild(keyEl);

        const valueEl = document.createElement('span');
        valueEl.classList.add('logs-data-view-other-field-value');
        valueEl.textContent = value_;
        td.appendChild(valueEl);
      });

      return td;
    };
  }

  private onColumnsMultiSelectSelect(
    item: WidgetToolbarMultiSelectItemOptions
  ) {
    this.columnsMultiSelect.select(item.id);
    this.updateHot();
  }

  private onColumnsMultiSelectUnselect(
    item: WidgetToolbarMultiSelectItemOptions
  ) {
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
