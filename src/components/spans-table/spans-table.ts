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
import { Span } from '../../model/interfaces';
import find from 'lodash/find';
import remove from 'lodash/remove';
import sampleSize from 'lodash/sampleSize';
import { clipboard } from 'electron';
import cloneDeep from 'lodash/cloneDeep';
import EventEmitter from 'events';
import {
  ContextMenuManager,
  ContextMenuEvent
} from '../ui/context-menu/context-menu-manager';
import * as opentracing from 'opentracing';
import { OperationNamePrefix } from '../../utils/self-tracing/opname-prefix-decorator';
import {
  Stalk,
  NewTrace,
  ChildOf,
  FollowsFrom
} from '../../utils/self-tracing/trace-decorator';
import { Modal, ModalCloseTriggerType } from '../ui/modal/modal';
import { ModalManager } from '../ui/modal/modal-manager';
import {
  SpanFilteringFormModalContent,
  SpanFilteringRawOptions
} from '../customization/span-filtering-form-modal-content';
import Noty from 'noty';

import SvgFilter from '!!raw-loader!@mdi/svg/svg/filter.svg';
import SvgFilterRemove from '!!raw-loader!@mdi/svg/svg/filter-remove.svg';
import SvgViewColumn from '!!raw-loader!@mdi/svg/svg/view-column.svg';
import '../ui/widget-toolbar/widget-toolbar.css';
import 'tabulator-tables/dist/css/tabulator_simple.min.css';
import './spans-table.css';

const TOOLBAR_HEIGHT = 27; // TODO: Sorry :(

export interface SpanRowData {
  span: Span;
  spanOriginal: Span;
  totalTime: number;
  selfTime: number;
  serviceName: string;
}

export enum SpansTableViewEvent {
  SPAN_SELECTED = 'span_selected'
}

@OperationNamePrefix('spans-table.')
export class SpansTableView extends EventEmitter {
  private stage = Stage.getSingleton();
  private contextMenuManager = ContextMenuManager.getSingleton();
  private table: Tabulator;
  private spanRows: SpanRowData[] = [];
  private selectedSpanId: string;

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
    onSpanFilteringModalClose: this.onSpanFilteringModalClose.bind(this),
    formatTimestamp: this.formatTimestamp.bind(this),
    formatDuration: this.formatDuration.bind(this),
    formatTags: this.formatTags.bind(this),
    formatProcessTags: this.formatProcessTags.bind(this),
    onRowClick: this.onRowClick.bind(this),
    onRowContext: this.onRowContext.bind(this),
    onKeyDown: this.onKeyDown.bind(this)
  };

  private columnDefinitions = {
    id: { title: 'Span ID', field: 'span.id' } as Tabulator.ColumnDefinition,
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
    startTime: {
      title: 'Start Time',
      field: 'span.startTime',
      formatter: this.binded.formatTimestamp
    } as Tabulator.ColumnDefinition,
    finishTime: {
      title: 'Finish Time',
      field: 'span.finishTime',
      formatter: this.binded.formatTimestamp
    } as Tabulator.ColumnDefinition,
    totalTime: {
      title: 'Total Time',
      field: 'totalTime',
      formatter: this.binded.formatDuration
    } as Tabulator.ColumnDefinition,
    selfTime: {
      title: 'Self Time',
      field: 'selfTime',
      formatter: this.binded.formatDuration
    } as Tabulator.ColumnDefinition,
    tags: {
      title: 'Tags',
      field: 'span.tags',
      formatter: this.binded.formatTags,
      headerSort: false
    } as Tabulator.ColumnDefinition,
    processTags: {
      title: 'Process Tags',
      field: 'span.process.tags',
      formatter: this.binded.formatProcessTags,
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
    emptyMessage: 'No Spans'
  });

  private spanFilteringFn: (span: Span) => boolean;
  private spanFilteringFormModalContent: SpanFilteringFormModalContent;
  private spanFilteringRawOptions: SpanFilteringRawOptions;

  constructor() {
    super();

    const { container, toolbar, tableContainer } = this.elements;
    container.classList.add('spans-table-view');
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
    this.spanRows = this.stage
      .getAllSpans()
      .map(span => this.span2RowData(span));

    // Init table
    this.table = new Tabulator(this.elements.tableContainer, {
      autoResize: false, // This causes to lose focus when widget is hidden
      height: this.viewPropertiesCache.height - TOOLBAR_HEIGHT,
      data: this.spanRows,
      layout: 'fitDataFill',
      movableColumns: true,
      selectable: 1,
      columns: [
        this.columnDefinitions.startTime,
        this.columnDefinitions.totalTime,
        this.columnDefinitions.selfTime,
        this.columnDefinitions.operationName,
        this.columnDefinitions.serviceName
      ],
      initialSort: [
        { column: this.columnDefinitions.startTime.field, dir: 'asc' }
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
          content: 'Filter Spans',
          multiple: true
        }
      ]
    ]);
    tooltipManager.addToSingleton([
      [
        btn.removeFilter,
        {
          content: 'Remove Span Filter',
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
    let includesErrorTag = false;
    trace.spans.forEach(span => {
      if (span.tags.error) includesErrorTag = true;
      this.spanRows.push(this.span2RowData(span));
    });
    ctx.log({ message: `Spans processed & added` });

    // If any span includes `error` tag, add error column if not already added!
    if (includesErrorTag) {
      const currentColumns = this.table.getColumnDefinitions();
      const isAdded = !!find(
        currentColumns,
        col => col.field == getColumnFieldSelectorByTag('error')
      );
      if (!isAdded) {
        this.addColumnGracefullyBeforeTagsOrProcessTagsColumn({
          // The title and field must be same with normal generated
          // column struct, see: `onColumnsMultiSelectSelect()` method
          title: getColumnIdByTag('error'),
          field: getColumnFieldSelectorByTag('error'),
          formatter: cell => {
            const spanRow = cell.getRow().getData();
            return spanRow.span.tags.error || '';
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
      remove(this.spanRows, spanRow => spanRow.span.id == span.id)
    );
    ctx.log({ message: `Spans removed` });

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

    Object.keys(this.stage.getAllSpanTags()).forEach(tag => {
      const selected = !!find(
        currentColumns,
        col => col.field == getColumnFieldSelectorByTag(tag)
      );
      items.push({
        id: getColumnIdByTag(tag),
        text: getColumnIdByTag(tag),
        category: 'Span Tags',
        selected
      });
    });

    Object.keys(this.stage.getAllProcessTags()).forEach(tag => {
      const selected = !!find(
        currentColumns,
        col => col.field == getColumnFieldSelectorByProcessTag(tag)
      );
      items.push({
        id: getColumnIdByProcessTag(tag),
        text: getColumnIdByProcessTag(tag),
        category: 'Process Tags',
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
          col.title.indexOf(TAG_ID_PREFIX) == 0
            ? 'Span Tags'
            : col.title.indexOf(PROCESS_TAG_ID_PREFIX) == 0
            ? 'Process Tags'
            : undefined,
        selected: true
      });
    });

    this.columnsMultiSelect.updateItems(items);
  }

  private onColumnsMultiSelectSelect(item: WidgetToolbarMultiSelectItem) {
    this.columnsMultiSelect.select(item.id);

    let columnDefinition: Tabulator.ColumnDefinition = (this
      .columnDefinitions as any)[item.id];

    if (!columnDefinition && item.id.indexOf(TAG_ID_PREFIX) == 0) {
      const tagKey = item.id.replace(TAG_ID_PREFIX, '');
      columnDefinition = {
        title: item.id,
        field: `span.tags.${tagKey}`,
        formatter: cell => {
          const spanRow = cell.getRow().getData();
          return spanRow.span.tags[tagKey] || '';
        }
      };
    }

    if (!columnDefinition && item.id.indexOf(PROCESS_TAG_ID_PREFIX) == 0) {
      const tagKey = item.id.replace(PROCESS_TAG_ID_PREFIX, '');
      columnDefinition = {
        title: item.id,
        field: `span.process.tags.${tagKey}`,
        formatter: cell => {
          const spanRow = cell.getRow().getData();
          const processTags = spanRow.span.process
            ? spanRow.span.process.tags || {}
            : {};
          return processTags[tagKey] || '';
        }
      };
    }

    if (!columnDefinition) {
      console.error(`Unknown column id: "${item.id}"`, item);
      throw new Error(`Unknown column id: "${item.id}"`);
    }

    this.addColumnGracefullyBeforeTagsOrProcessTagsColumn(columnDefinition);
  }

  private addColumnGracefullyBeforeTagsOrProcessTagsColumn(
    def: Tabulator.ColumnDefinition
  ) {
    const currentColumns = this.table.getColumnDefinitions();
    const columnDef = find(currentColumns, col => {
      return (
        col.field == this.columnDefinitions.tags.field ||
        col.field == this.columnDefinitions.processTags.field
      );
    });

    if (columnDef) {
      this.table.addColumn(def, true, columnDef.field);
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

    if (!fieldToDelete && item.id.indexOf(TAG_ID_PREFIX) == 0) {
      const tagKey = item.id.replace(TAG_ID_PREFIX, '');
      fieldToDelete = `span.tags.${tagKey}`;
    }

    if (!fieldToDelete && item.id.indexOf(PROCESS_TAG_ID_PREFIX) == 0) {
      const tagKey = item.id.replace(PROCESS_TAG_ID_PREFIX, '');
      fieldToDelete = `span.process.tags.${tagKey}`;
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

  private span2RowData(span: Span) {
    const totalTime = span.finishTime - span.startTime;
    const selfTime = this.stage.getSpanSelfTime(span.id);
    const serviceName = serviceNameOf(span);

    // When a custom `tag` column added, tabulator defines a property
    // in all of the span tags object, even if it's undefined. This is
    // a mutation that we don't want now. As a workaround, clone the span.
    const spanCopy = cloneDeep(span);

    return {
      id: span.id,
      span: spanCopy,
      spanOriginal: span,
      totalTime,
      selfTime,
      serviceName
    };
  }

  private formatTimestamp(cell: any) {
    return formatMicroseconds(cell.getValue() - this.stage.startTimestamp);
  }

  private formatDuration(cell: any) {
    return formatMicroseconds(cell.getValue());
  }

  private formatTags(cell: any) {
    const spanRowData = cell.getRow().getData();
    let html = '';

    // TODO: Sort these with occurance frequency
    Object.keys(spanRowData.spanOriginal.tags)
      .sort((a, b) => {
        if (a > b) return 1;
        if (a < b) return -1;
        return 0;
      })
      .forEach(tag => {
        const value = spanRowData.spanOriginal.tags[tag];

        html += `<span class="spans-table-tag">${tag}:</span>
        <span class="spans-table-value">${value}</span>`;
      });

    return html;
  }

  private formatProcessTags(cell: any) {
    const spanRowData = cell.getRow().getData();
    let html = '';

    Object.keys(
      spanRowData.spanOriginal.process ? spanRowData.spanOriginal.process.tags || {} : {}
    )
      .sort((a, b) => {
        if (a > b) return 1;
        if (a < b) return -1;
        return 0;
      })
      .forEach(tag => {
        const value = spanRowData.spanOriginal.process.tags[tag];

        html += `<span class="spans-table-tag">${tag}:</span>
        <span class="spans-table-value">${value}</span>`;
      });

    return html;
  }

  private async updateTableData() {
    const filterFn = this.spanFilteringFn;
    if (filterFn) {
      try {
        const results = this.spanRows.filter(spanRow => {
          // Perform filtering on original span object
          // `spanRow.span` can be modified depending on visible columns by tabulator
          return filterFn(spanRow.spanOriginal);
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

    await this.table.replaceData(this.spanRows);
    this.updateRowSelectionGracefully();
  }

  private updateRowSelectionGracefully() {
    if (!this.selectedSpanId) return;
    this.selectSpan(this.selectedSpanId, true);
  }

  private showFilterModal() {
    this.spanFilteringFormModalContent = new SpanFilteringFormModalContent({
      rawOptions: this.spanFilteringRawOptions
    });
    const modal = new Modal({
      content: this.spanFilteringFormModalContent.getElement(),
      onClose: this.binded.onSpanFilteringModalClose
    });
    ModalManager.getSingleton().show(modal);
    this.spanFilteringFormModalContent.init(); // must be called after modal is rendered
  }

  private onFilterButtonClick() {
    this.showFilterModal();
  }

  private async onSpanFilteringModalClose(
    triggerType: ModalCloseTriggerType,
    data: any
  ) {
    if (this.spanFilteringFormModalContent) {
      this.spanFilteringFormModalContent.dispose();
      this.spanFilteringFormModalContent = null;
    }

    if (
      triggerType != ModalCloseTriggerType.CLOSE_METHOD_CALL ||
      data.action != 'save'
    ) {
      return;
    }

    this.spanFilteringRawOptions = {
      key: 'custom',
      name: 'Custom',
      rawCode: data.tsCode,
      compiledCode: data.compiledJSCode
    };
    this.spanFilteringFn = data.filterBy;

    this.elements.toolbarBtn.filter.classList.add('selected');
    this.elements.toolbarBtn.removeFilter.classList.remove('disabled');

    await this.updateTableData();
  }

  private async onRemoveFilterButtonClick() {
    await this.removeFilter();
  }

  async removeFilter() {
    this.spanFilteringFn = null;

    this.elements.toolbarBtn.filter.classList.remove('selected');
    this.elements.toolbarBtn.removeFilter.classList.add('disabled');

    await this.updateTableData();
  }

  selectSpan(spanId: string, silent = false) {
    if (!spanId) {
      this.selectedSpanId = null;
      this.table.deselectRow();
      !silent && this.emit(SpansTableViewEvent.SPAN_SELECTED, null);
      return;
    }

    const row = this.table.getRow(spanId);
    if (!row) {
      this.selectedSpanId = null;
      this.table.deselectRow();
      !silent && this.emit(SpansTableViewEvent.SPAN_SELECTED, null);
      return;
    }

    this.selectedSpanId = spanId;
    this.table.deselectRow();
    row.select();
    !silent && this.emit(SpansTableViewEvent.SPAN_SELECTED, spanId);
  }

  focusSpan(spanId: string) {
    const row = this.table.getRow(spanId);
    if (!row) return;
    this.table.scrollToRow(spanId);
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
    const spanRow = row.getData() as SpanRowData;
    this.selectSpan(spanRow.span.id);
  }

  private onRowContext(e: MouseEvent, row: Tabulator.RowComponent) {
    const spanRow = row.getData() as SpanRowData;

    this.contextMenuManager.show({
      x: e.clientX,
      y: e.clientY,
      menuItems: [
        {
          selectItem: {
            type: 'item',
            text: 'Show in Timeline View',
            id: 'showInTimelineView'
          },
          emitEvent: {
            event: ContextMenuEvent.SHOW_SPAN_IN_TIMELINE_VIEW,
            data: spanRow.span.id
          }
        },
        {
          selectItem: {
            type: 'item',
            text: 'Copy Span To Clipboard',
            id: 'copyToClipboard',
            altText: '⌘C'
          },
          onSelected: () => this.copySpanToClipboard(spanRow.span.id)
        }
      ]
    });
  }

  private copySpanToClipboard(spanId: string) {
    if (!spanId) return;
    const spanRow = find(this.spanRows, row => row.span.id == spanId);
    if (!spanRow) return;
    clipboard.writeText(JSON.stringify(spanRow.spanOriginal, null, 4));
  }

  getSelectedSpanId() {
    return this.selectedSpanId;
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

    // CMD + C => Copy the JSON of selected span (if exists)
    if (e.key == 'c' && (e.ctrlKey || e.metaKey)) {
      if (!this.selectedSpanId) return;
      const span = this.stage.getMainSpanGroup().get(this.selectedSpanId);
      if (!span) return;
      clipboard.writeText(JSON.stringify(span, null, 4));
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

    this.removeAllListeners();
  }
}

const TAG_ID_PREFIX = `tag.`;
const PROCESS_TAG_ID_PREFIX = `process.tag.`;

function getColumnIdByTag(tag: string) {
  return `${TAG_ID_PREFIX}${tag}`;
}

function getColumnFieldSelectorByTag(tag: string) {
  return `span.tags.${tag}`;
}

function getColumnIdByProcessTag(tag: string) {
  return `${PROCESS_TAG_ID_PREFIX}${tag}`;
}

function getColumnFieldSelectorByProcessTag(tag: string) {
  return `span.process.tags.${tag}`;
}
