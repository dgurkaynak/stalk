import tippy, { Instance as TippyInstance } from 'tippy.js';
import {
  WidgetToolbarMultiSelect,
  WidgetToolbarMultiSelectItem
} from '../ui/widget-toolbar/widget-toolbar-multi-select';
import { Stage, StageEvent } from '../../model/stage';
import { Trace } from '../../model/trace';
import { formatMicroseconds } from '../../utils/format-microseconds';
import { TooltipManager } from '../ui/tooltip/tooltip-manager';
import { serviceNameOf } from '../../model/span-grouping/service-name';
import * as Tabulator from 'tabulator-tables';
import { Span, SpanLog } from '../../model/interfaces';
import find from 'lodash/find';
import remove from 'lodash/remove';
import sampleSize from 'lodash/sampleSize';
import { clipboard } from 'electron';
import cloneDeep from 'lodash/cloneDeep';
import {
  ContextMenuManager,
  ContextMenuEvent
} from '../ui/context-menu/context-menu-manager';
import * as shortid from 'shortid';
import * as opentracing from 'opentracing';
import { OperationNamePrefix } from '../../utils/self-tracing/opname-prefix-decorator';
import {
  Stalk,
  NewTrace,
  ChildOf,
  FollowsFrom
} from '../../utils/self-tracing/trace-decorator';
import EventEmitter from 'events';
import { Modal, ModalCloseTriggerType } from '../ui/modal/modal';
import { ModalManager } from '../ui/modal/modal-manager';
import {
  LogFilteringFormModalContent,
  LogFilteringRawOptions
} from '../customization/log-filtering-form-modal-content';
import Noty from 'noty';

import SvgFilter from '!!raw-loader!@mdi/svg/svg/filter.svg';
import SvgFilterRemove from '!!raw-loader!@mdi/svg/svg/filter-remove.svg';
import SvgViewColumn from '!!raw-loader!@mdi/svg/svg/view-column.svg';
import '../ui/widget-toolbar/widget-toolbar.css';
import 'tabulator-tables/dist/css/tabulator_simple.min.css';
import './logs-table.css';

const TOOLBAR_HEIGHT = 27; // TODO: Sorry :(

export interface LogRowData {
  id: string;
  span: Span;
  spanOriginal: Span;
  serviceName: string;
  timestamp: number;
  spanTimestamp: number;
  fields: { [key: string]: string };
  fieldsOriginal: { [key: string]: string };
}

export enum LogsTableViewEvent {
  LOG_SELECTED = 'log_selected'
}

@OperationNamePrefix('logs-table.')
export class LogsTableView extends EventEmitter {
  private stage = Stage.getSingleton();
  private contextMenuManager = ContextMenuManager.getSingleton();
  private table: Tabulator;
  private logRows: LogRowData[] = [];
  private selectedLogId: string;

  private elements = {
    container: document.createElement('div'),
    toolbar: document.createElement('div'),
    toolbarBtn: {
      filter: document.createElement('div'),
      removeFilter: document.createElement('div'),
      columns: document.createElement('div')
    },
    tableContainer: document.createElement('div')
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
    ),
    onFilterButtonClick: this.onFilterButtonClick.bind(this),
    onRemoveFilterButtonClick: this.onRemoveFilterButtonClick.bind(this),
    onLogFilteringModalClose: this.onLogFilteringModalClose.bind(this),
    formatTimestamp: this.formatTimestamp.bind(this),
    formatDuration: this.formatDuration.bind(this),
    formatFields: this.formatFields.bind(this),
    onRowClick: this.onRowClick.bind(this),
    onRowContext: this.onRowContext.bind(this),
    onKeyDown: this.onKeyDown.bind(this)
  };

  private columnDefinitions = {
    spanId: {
      title: 'Span ID',
      field: 'span.id'
    } as Tabulator.ColumnDefinition,
    traceId: {
      title: 'Trace ID',
      field: 'span.traceId'
    } as Tabulator.ColumnDefinition,
    operationName: {
      title: 'Operation Name',
      field: 'span.operationName'
    } as Tabulator.ColumnDefinition,
    serviceName: {
      title: 'Service Name',
      field: 'serviceName'
    } as Tabulator.ColumnDefinition,
    timestamp: {
      title: 'Timestamp',
      field: 'timestamp',
      formatter: this.binded.formatTimestamp
    } as Tabulator.ColumnDefinition,
    spanTimestamp: {
      title: 'In-Span Timestamp',
      field: 'spanTimestamp',
      formatter: this.binded.formatDuration
    } as Tabulator.ColumnDefinition,
    fields: {
      title: 'Fields',
      field: 'fields',
      formatter: this.binded.formatFields,
      headerSort: false
    } as Tabulator.ColumnDefinition
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

  private logFilteringFn: (log: SpanLog, span: Span) => boolean;
  private logFilteringFormModalContent: LogFilteringFormModalContent;
  private logFilteringRawOptions: LogFilteringRawOptions;

  constructor() {
    super();

    const { container, toolbar, tableContainer } = this.elements;
    container.classList.add('logs-table-view');
    container.appendChild(toolbar);
    container.appendChild(tableContainer);
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

    // Left buttons
    btn.filter.classList.add('widget-toolbar-button');
    btn.filter.innerHTML = SvgFilter;
    leftPane.appendChild(btn.filter);

    btn.removeFilter.classList.add('widget-toolbar-button');
    btn.removeFilter.innerHTML = SvgFilterRemove;
    btn.removeFilter.classList.add('disabled');
    leftPane.appendChild(btn.removeFilter);

    // Right buttons
    btn.columns.classList.add('widget-toolbar-button');
    btn.columns.innerHTML = SvgViewColumn;
    rightPane.appendChild(btn.columns);
  }

  @Stalk({ handler: ChildOf })
  init(ctx: opentracing.Span, options: { width: number; height: number }) {
    this.viewPropertiesCache = {
      width: options.width,
      height: options.height
    };
    this.initTooltips(ctx);
    this.initDropdowns(ctx);

    // Bind events
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onTraceRemoved);
    this.elements.toolbarBtn.filter.addEventListener(
      'click',
      this.binded.onFilterButtonClick,
      false
    );
    this.elements.toolbarBtn.removeFilter.addEventListener(
      'click',
      this.binded.onRemoveFilterButtonClick,
      false
    );
    this.elements.container.addEventListener(
      'keydown',
      this.binded.onKeyDown,
      false
    );

    // Prepare initial data
    this.logRows = this.stage
      .getAllLogs()
      .map(([log, span]) => this.log2RowData(log, span));

    // Init table
    this.table = new Tabulator(this.elements.tableContainer, {
      autoResize: false, // This causes to lose focus when widget is hidden
      height: this.viewPropertiesCache.height - TOOLBAR_HEIGHT,
      data: this.logRows,
      layout: 'fitDataFill',
      movableColumns: true,
      selectable: 1,
      columns: [
        this.columnDefinitions.timestamp,
        this.columnDefinitions.spanTimestamp,
        this.columnDefinitions.operationName,
        this.columnDefinitions.serviceName,
        this.columnDefinitions.fields
      ],
      initialSort: [
        { column: this.columnDefinitions.timestamp.field, dir: 'asc' }
      ],
      rowClick: this.binded.onRowClick,
      rowContext: this.binded.onRowContext,
      keybindings: false
    });

    // Init column picker
    this.updateColumnsMultiSelectItems(ctx);
  }

  @Stalk({ handler: ChildOf })
  private initTooltips(ctx: opentracing.Span) {
    const tooltipManager = TooltipManager.getSingleton();
    const btn = this.elements.toolbarBtn;
    tooltipManager.addToSingleton([
      [
        btn.filter,
        {
          content: 'Filter Logs',
          multiple: true
        }
      ]
    ]);
    tooltipManager.addToSingleton([
      [
        btn.removeFilter,
        {
          content: 'Remove Log Filter',
          multiple: true
        }
      ]
    ]);
    tooltipManager.addToSingleton([
      [
        btn.columns,
        {
          content: 'Customize Columns',
          multiple: true
        }
      ]
    ]);
  }

  @Stalk({ handler: ChildOf })
  private initDropdowns(ctx: opentracing.Span) {
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

  @Stalk({ handler: FollowsFrom })
  private async onTraceAdded(ctx: opentracing.Span, trace: Trace) {
    let includesErrorField = false;
    let totalLogCount = 0;
    const fieldCounts: { [key: string]: number } = {};

    // Scan the added spans, prepare the log data
    trace.spans.forEach(span => {
      span.logs.forEach(log => {
        if (log.fields.error) includesErrorField = true;
        const rowData = this.log2RowData(log, span);
        Object.keys(rowData.fields).forEach(fieldKey => {
          if (!fieldCounts[fieldKey]) fieldCounts[fieldKey] = 0;
          fieldCounts[fieldKey]++;
        });
        this.logRows.push(rowData);
        totalLogCount++;
      });
    });
    ctx.addTags({ logCount: totalLogCount });
    ctx.log({ message: `Spans processed & logs added` });

    // If any field has more than %90 occurance rate, add the column (if not already added!)
    Object.keys(fieldCounts).forEach(fieldKey => {
      const rate = fieldCounts[fieldKey] / totalLogCount;
      if (rate < 0.9) return;

      // Duplication alert
      const currentColumns = this.table.getColumnDefinitions();
      const isAdded = !!find(
        currentColumns,
        col => col.field == getColumnIdByFieldKey(fieldKey)
      );
      if (!isAdded) {
        this.addColumnGracefullyBeforeFieldsColumn({
          // The title and field must be same with normal generated
          // column struct, see: `onColumnsMultiSelectSelect()` method
          title: getColumnIdByFieldKey(fieldKey),
          field: getColumnFieldSelectorByFieldKey(fieldKey),
          formatter: cell => {
            const logRow = cell.getRow().getData();
            return logRow.fields[fieldKey] || '';
          }
        });
      }
    });
    ctx.log({ message: `Log fields analyzed for auto-column display` });

    // If any span includes `error` tag, add error column (if not already added!)
    if (includesErrorField) {
      const currentColumns = this.table.getColumnDefinitions();
      const isAdded = !!find(
        currentColumns,
        col => col.field == getColumnIdByFieldKey('error')
      );
      if (!isAdded) {
        this.addColumnGracefullyBeforeFieldsColumn({
          // The title and field must be same with normal generated
          // column struct, see: `onColumnsMultiSelectSelect()` method
          title: getColumnIdByFieldKey('error'),
          field: getColumnFieldSelectorByFieldKey('error'),
          formatter: cell => {
            const logRow = cell.getRow().getData();
            return logRow.fields.error || '';
          }
        });
      }
    }

    this.updateColumnsMultiSelectItems(ctx);
    await this.updateTableData();
  }

  @Stalk({ handler: FollowsFrom })
  private async onTraceRemoved(ctx: opentracing.Span, trace: Trace) {
    trace.spans.forEach(span =>
      remove(this.logRows, logRow => logRow.span.id == span.id)
    );

    this.updateColumnsMultiSelectItems(ctx);
    await this.updateTableData();
  }

  @Stalk({ handler: ChildOf })
  private updateColumnsMultiSelectItems(ctx: opentracing.Span) {
    const currentColumns = this.table.getColumnDefinitions();
    const items: WidgetToolbarMultiSelectItem[] = Object.keys(
      this.columnDefinitions
    ).map(id => {
      const def = (this.columnDefinitions as any)[id];
      const selected = !!find(currentColumns, col => col.field == def.field);
      return { id, text: def.title as string, selected };
    });

    Object.keys(this.stage.getAllLogFieldKeys()).forEach(fieldKey => {
      const selected = !!find(
        currentColumns,
        col => col.field == getColumnFieldSelectorByFieldKey(fieldKey)
      );
      items.push({
        id: getColumnIdByFieldKey(fieldKey),
        text: getColumnIdByFieldKey(fieldKey),
        category: 'Log Fields',
        selected
      });
    });

    // There may be left-over columns in the table, which means that
    // column is added when some trace is added in stage. However that trace
    // removed now, and that column is not existing in future stage state.
    // When that happens, there is no way to remove that columns.
    currentColumns.forEach(col => {
      if (!!find(items, item => item.text == col.title)) return;
      items.push({
        id: col.title,
        text: col.title,
        category:
          col.title.indexOf(FIELD_ID_PREFIX) == 0 ? 'Log Fields' : undefined,
        selected: true
      });
    });

    this.columnsMultiSelect.updateItems(items);
  }

  private onColumnsMultiSelectSelect(item: WidgetToolbarMultiSelectItem) {
    this.columnsMultiSelect.select(item.id);

    let columnDefinition: Tabulator.ColumnDefinition = (this
      .columnDefinitions as any)[item.id];

    if (!columnDefinition && item.id.indexOf(FIELD_ID_PREFIX) == 0) {
      const fieldKey = item.id.replace(FIELD_ID_PREFIX, '');
      columnDefinition = {
        title: item.id,
        field: getColumnFieldSelectorByFieldKey(fieldKey),
        formatter: cell => {
          const logRow = cell.getRow().getData();
          return logRow.fields[fieldKey] || '';
        }
      };
    }

    if (!columnDefinition) {
      console.error(`Unknown column id: "${item.id}"`, item);
      throw new Error(`Unknown column id: "${item.id}"`);
    }

    this.addColumnGracefullyBeforeFieldsColumn(columnDefinition);
  }

  private addColumnGracefullyBeforeFieldsColumn(
    def: Tabulator.ColumnDefinition
  ) {
    const currentColumns = this.table.getColumnDefinitions();
    const isFieldsColumnExists = !!find(
      currentColumns,
      col => col.field == this.columnDefinitions.fields.field
    );

    if (isFieldsColumnExists) {
      this.table.addColumn(def, true, this.columnDefinitions.fields.field);
    } else {
      this.table.addColumn(def);
    }
  }

  private onColumnsMultiSelectUnselect(item: WidgetToolbarMultiSelectItem) {
    this.columnsMultiSelect.unselect(item.id);
    let fieldToDelete: string = '';

    if ((this.columnDefinitions as any)[item.id]) {
      fieldToDelete = (this.columnDefinitions as any)[item.id].field;
    }

    if (!fieldToDelete && item.id.indexOf(FIELD_ID_PREFIX) == 0) {
      const fieldKey = item.id.replace(FIELD_ID_PREFIX, '');
      fieldToDelete = getColumnFieldSelectorByFieldKey(fieldKey);
    }

    if (!fieldToDelete) {
      console.error(`Unknown column id: "${item.id}"`, item);
      throw new Error(`Unknown column id: "${item.id}"`);
    }

    this.table.deleteColumn(fieldToDelete);
  }

  private onColumnsMultiSelectSearchInput() {
    // Probably height of the multi-select is changed,
    // if tippy is forced to render top position, this breaks the
    // arrow positioning. This is a workaround for updating its
    // position again
    this.dropdowns.columnsSelection.popperInstance.update();
  }

  private log2RowData(log: SpanLog, span: Span) {
    const spanTimestamp = log.timestamp - span.startTime;
    const serviceName = serviceNameOf(span);

    // When a custom `field` column added, tabulator defines a property
    // in all of the log fields object, even if it's undefined. This is
    // a mutation that we don't want now. As a workaround, clone the span & log fields.
    // See spans-table for further detail.
    const spanCopy = cloneDeep(span);
    const fieldsCopy = cloneDeep(log.fields);

    return {
      id: shortid.generate(),
      span: spanCopy,
      spanOriginal: span,
      timestamp: log.timestamp,
      spanTimestamp,
      fields: fieldsCopy,
      fieldsOriginal: log.fields,
      serviceName
    };
  }

  private formatTimestamp(cell: any) {
    return formatMicroseconds(cell.getValue() - this.stage.startTimestamp);
  }

  private formatDuration(cell: any) {
    return formatMicroseconds(cell.getValue());
  }

  private formatFields(cell: any) {
    const logRowData = cell.getRow().getData();
    const currentColumns = this.table.getColumnDefinitions();
    let html = '';

    // TODO: Sort these with occurance frequency
    Object.keys(logRowData.fields)
      .sort((a, b) => {
        if (a > b) return 1;
        if (a < b) return -1;
        return 0;
      })
      .forEach(fieldKey => {
        const value = logRowData.fields[fieldKey];

        // When adding/removing fields, tabulator adds a property
        // to object with `undefined` value. We're filtering that.
        if (!value) return;

        html += `<span class="logs-table-tag">${fieldKey}:</span>
        <span class="logs-table-value">${value}</span>`;
      });

    return html;
  }

  private async updateTableData() {
    const filterFn = this.logFilteringFn;
    if (filterFn) {
      try {
        const results = this.logRows.filter(logRow => {
          // Perform filtering on original span object & log fields
          // `log.fields` and `span` can be modified depending on visible columns by tabulator
          return filterFn({
            timestamp: logRow.timestamp,
            fields: logRow.fieldsOriginal
          }, logRow.spanOriginal);
        });

        await this.table.replaceData(results);
        this.updateRowSelectionGracefully();
      } catch (err) {
        console.error(err);
        new Noty({
          text:
            `Unexpected error while filtering spans: "${err.message} <br /><br />"` +
            `Please check your console for further details. Press Command+Option+I or Ctrl+Option+I to ` +
            `open devtools.`,
          type: 'error'
        }).show();
      }

      return;
    }

    await this.table.replaceData(this.logRows);
    this.updateRowSelectionGracefully();
  }

  private updateRowSelectionGracefully() {
    if (!this.selectedLogId) return;
    this.selectLog(this.selectedLogId, true);
  }

  private showFilterModal() {
    this.logFilteringFormModalContent = new LogFilteringFormModalContent({
      rawOptions: this.logFilteringRawOptions
    });
    const modal = new Modal({
      content: this.logFilteringFormModalContent.getElement(),
      onClose: this.binded.onLogFilteringModalClose
    });
    ModalManager.getSingleton().show(modal);
    this.logFilteringFormModalContent.init(); // must be called after modal is rendered
  }

  private onFilterButtonClick() {
    this.showFilterModal();
  }

  private async onLogFilteringModalClose(
    triggerType: ModalCloseTriggerType,
    data: any
  ) {
    if (this.logFilteringFormModalContent) {
      this.logFilteringFormModalContent.dispose();
      this.logFilteringFormModalContent = null;
    }

    if (
      triggerType != ModalCloseTriggerType.CLOSE_METHOD_CALL ||
      data.action != 'save'
    ) {
      return;
    }

    this.logFilteringRawOptions = {
      key: 'custom',
      name: 'Custom',
      rawCode: data.tsCode,
      compiledCode: data.compiledJSCode
    };
    this.logFilteringFn = data.filterBy;

    this.elements.toolbarBtn.filter.classList.add('selected');
    this.elements.toolbarBtn.removeFilter.classList.remove('disabled');

    await this.updateTableData();
  }

  private async onRemoveFilterButtonClick() {
    await this.removeFilter();
  }

  async removeFilter() {
    this.logFilteringFn = null;

    this.elements.toolbarBtn.filter.classList.remove('selected');
    this.elements.toolbarBtn.removeFilter.classList.add('disabled');

    await this.updateTableData();
  }

  selectLog(logId: string, silent = false) {
    if (!logId) {
      this.selectedLogId = null;
      this.table.deselectRow();
      !silent && this.emit(LogsTableViewEvent.LOG_SELECTED, {});
      return;
    }

    const row = this.table.getRow(logId);
    if (!row) {
      this.selectedLogId = null;
      this.table.deselectRow();
      !silent && this.emit(LogsTableViewEvent.LOG_SELECTED, {});
      return;
    }

    this.selectedLogId = logId;
    this.table.deselectRow();
    row.select();

    const logData = row.getData();
    !silent && this.emit(LogsTableViewEvent.LOG_SELECTED, logData);
  }

  focusLog(logId: string) {
    const row = this.table.getRow(logId);
    if (!row) return;
    this.table.scrollToRow(logId);
  }

  redrawTable() {
    // Tabulator's layout mode `fitDataFill` is a little buggy
    // When the widget is not shown, a new trace is added
    // Row widths are broken. So as a workaround, we will check
    // the first cell's width of some random rows are equal or not
    // If they'are not equal, force re-render the table.
    let forceRerender = false;
    const firstCells = this.elements.tableContainer.querySelectorAll(
      '.tabulator-table > .tabulator-row .tabulator-cell:first-child'
    );
    const randomCells = sampleSize(firstCells, 10) as HTMLElement[];
    if (randomCells.length > 2) {
      const widthOfFirstCell = randomCells[0].offsetWidth;
      const areEqual = randomCells.every(
        el => el.offsetWidth === widthOfFirstCell
      );
      if (!areEqual) forceRerender = true;
    }

    this.table.redraw(forceRerender);
  }

  private onRowClick(e: any, row: Tabulator.RowComponent) {
    const logRow = row.getData() as LogRowData;
    this.selectLog(logRow.id);
  }

  private onRowContext(e: MouseEvent, row: Tabulator.RowComponent) {
    const logRow = row.getData() as LogRowData;

    this.contextMenuManager.show({
      x: e.clientX,
      y: e.clientY,
      menuItems: [
        {
          selectItem: {
            type: 'item',
            text: 'Show Span in Timeline View',
            id: 'showInTimelineView'
          },
          emitEvent: {
            event: ContextMenuEvent.SHOW_SPAN_IN_TIMELINE_VIEW,
            data: logRow.span.id
          }
        },
        {
          selectItem: {
            type: 'item',
            text: 'Show Span in Table View',
            id: 'showInTableView'
          },
          emitEvent: {
            event: ContextMenuEvent.SHOW_SPAN_IN_TABLE_VIEW,
            data: logRow.span.id
          }
        },
        {
          selectItem: {
            type: 'item',
            text: 'Copy Log To Clipboard',
            id: 'copyToClipboard',
            altText: '⌘C'
          },
          onSelected: () => this.copyLogToClipboard(logRow.id)
        }
      ]
    });
  }

  private copyLogToClipboard(logId: string) {
    if (!logId) return;
    const logRow = find(this.logRows, row => row.id == logId);
    if (!logRow) return;
    const str = JSON.stringify(
      {
        timestamp: logRow.timestamp,
        fields: logRow.fieldsOriginal
      },
      null,
      4
    );
    clipboard.writeText(str);
  }

  getSelectedLogId() {
    return this.selectedLogId;
  }

  private onKeyDown(e: KeyboardEvent) {
    // If user is typing on any kind of input element which is
    // child of this component, we don't want to trigger shortcuts
    if (e.target instanceof HTMLInputElement) return;

    // CMD + F => Focus to search input elemen
    if (e.key == 'f' && (e.ctrlKey || e.metaKey)) {
      this.showFilterModal();
      return;
    }

    // CMD + C => Copy the JSON of selected log (if exists)
    if (e.key == 'c' && (e.ctrlKey || e.metaKey)) {
      if (!this.selectedLogId) return;
      this.copyLogToClipboard(this.selectedLogId);
      return;
    }
  }

  mount(parentEl: HTMLElement) {
    parentEl.appendChild(this.elements.container);
  }

  unmount() {
    const parent = this.elements.container.parentElement;
    parent?.removeChild(this.elements.container);
  }

  resize(width: number, height: number) {
    this.viewPropertiesCache = { width, height };
    this.table.setHeight(height - TOOLBAR_HEIGHT);
    this.redrawTable();
  }

  dispose() {
    this.table?.destroy();
    this.table = null;

    this.elements.toolbarBtn.filter.removeEventListener(
      'click',
      this.binded.onFilterButtonClick,
      false
    );
    this.elements.toolbarBtn.removeFilter.removeEventListener(
      'click',
      this.binded.onRemoveFilterButtonClick,
      false
    );
    this.elements.container.removeEventListener(
      'keydown',
      this.binded.onKeyDown,
      false
    );

    this.stage.removeListener(StageEvent.TRACE_ADDED, this.binded.onTraceAdded);
    this.stage.removeListener(
      StageEvent.TRACE_ADDED,
      this.binded.onTraceRemoved
    );

    const tooltipManager = TooltipManager.getSingleton();
    const btn = this.elements.toolbarBtn;
    tooltipManager.removeFromSingleton([btn.columns]);

    for (let tippy of Object.values(this.dropdowns)) {
      tippy.destroy();
    }
    this.dropdowns = null;
  }
}

const FIELD_ID_PREFIX = `field.`;

function getColumnIdByFieldKey(tag: string) {
  return `${FIELD_ID_PREFIX}${tag}`;
}

function getColumnFieldSelectorByFieldKey(fieldKey: string) {
  return `fields.${fieldKey}`;
}
