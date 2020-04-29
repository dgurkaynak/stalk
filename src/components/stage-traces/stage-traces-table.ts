import { Trace } from '../../model/trace';
import { Stage, StageEvent } from '../../model/stage';
import { formatMicroseconds } from '../../utils/format-microseconds';
import * as Tabulator from 'tabulator-tables';
import sampleSize from 'lodash/sampleSize';
import cloneDeep from 'lodash/cloneDeep';
import EventEmitter from 'events';
import format from 'date-fns/format';

import 'tabulator-tables/dist/css/tabulator_simple.min.css';
import './stage-traces-table.css';

export interface StageTraceRowData {
  id: string;
  startTime: number;
  finishTime: number;
  duration: number;
  name: string;
  spanCount: number;
  errorCount: number;
  services: { [key: string]: number };
}

export interface StageTracesTableOptions {
  width: number;
  height: number;
  footerElement?: HTMLElement;
  placeholderElement?: HTMLElement;
}

export enum StageTracesTableViewEvent {
  SELECTIONS_UPDATED = 'selections_updated'
}

export class StageTracesTableView extends EventEmitter {
  private stage = Stage.getSingleton();
  private options: StageTracesTableOptions;
  private table: Tabulator;
  private traceRows: StageTraceRowData[] = [];

  private elements = {
    container: document.createElement('div'),
    tableContainer: document.createElement('div')
  };
  private viewPropertiesCache = {
    width: 0,
    height: 0
  };

  private binded = {
    formatTimestamp: this.formatTimestamp.bind(this),
    formatDuration: this.formatDuration.bind(this),
    formatServices: this.formatServices.bind(this),
    rowSelectionChanged: this.rowSelectionChanged.bind(this),
    onKeyDown: this.onKeyDown.bind(this),
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this)
  };

  private columnDefinitions = {
    id: {
      title: 'Trace Id',
      field: 'id'
    } as Tabulator.ColumnDefinition,
    startTime: {
      title: 'Date',
      field: 'startTime',
      formatter: this.binded.formatTimestamp
    } as Tabulator.ColumnDefinition,
    duration: {
      title: 'Duration',
      field: 'duration',
      formatter: this.binded.formatDuration
    } as Tabulator.ColumnDefinition,
    name: {
      title: 'Root Span',
      field: 'name'
    } as Tabulator.ColumnDefinition,
    spanCount: {
      title: 'Span(s)',
      field: 'spanCount'
    } as Tabulator.ColumnDefinition,
    errorCount: {
      title: 'Error(s)',
      field: 'errorCount'
    } as Tabulator.ColumnDefinition,
    services: {
      title: 'Services & Span(s)',
      field: 'services',
      formatter: this.binded.formatServices,
      headerSort: false
    } as Tabulator.ColumnDefinition
  };

  constructor() {
    super();

    const { container, tableContainer } = this.elements;
    container.classList.add('stage-traces-table-view');
    container.appendChild(tableContainer);
  }

  init(options: StageTracesTableOptions) {
    this.options = options;
    this.viewPropertiesCache = {
      width: options.width,
      height: options.height
    };

    // Bind events
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    this.elements.container.addEventListener(
      'keydown',
      this.binded.onKeyDown,
      false
    );

    // Prepare initial data
    this.traceRows = this.stage
      .getAllTraces()
      .map(trace => this.trace2RowData(trace));

    // Init table
    this.table = new Tabulator(this.elements.tableContainer, {
      autoResize: false, // This causes to lose focus when widget is hidden
      height: this.viewPropertiesCache.height,
      data: this.traceRows,
      layout: 'fitDataFill',
      movableColumns: true,
      selectable: true,
      columns: [
        this.columnDefinitions.id,
        this.columnDefinitions.startTime,
        this.columnDefinitions.name,
        this.columnDefinitions.duration,
        this.columnDefinitions.spanCount,
        this.columnDefinitions.errorCount,
        this.columnDefinitions.services
      ],
      initialSort: [
        { column: this.columnDefinitions.startTime.field, dir: 'desc' }
      ],
      rowSelectionChanged: this.binded.rowSelectionChanged,
      selectableRangeMode: 'click',
      keybindings: false,
      footerElement: this.options.footerElement,
      placeholder: this.options.placeholderElement
    });
  }

  async updateTraces(traces: Trace[]) {
    this.traceRows = traces.map(t => this.trace2RowData(t));
    await this.table.replaceData(this.traceRows);
  }

  private rowSelectionChanged(data: any, rows: any) {
    this.emit(StageTracesTableViewEvent.SELECTIONS_UPDATED, data);
  }

  private trace2RowData(trace: Trace) {
    return {
      id: trace.id,
      startTime: trace.startTime,
      finishTime: trace.finishTime,
      duration: trace.duration,
      name: trace.name,
      spanCount: trace.spanCount,
      errorCount: trace.errorCount,
      services: cloneDeep(trace.spanCountsByService)
    };
  }

  private formatTimestamp(cell: any) {
    return format(cell.getValue() / 1000, 'MMM dd HH:mm:ss.SSS');
  }

  private formatDuration(cell: any) {
    return formatMicroseconds(cell.getValue());
  }

  private formatServices(cell: any) {
    const TraceRowData = cell.getRow().getData();
    let html = '';

    Object.keys(TraceRowData.services)
      .sort((a, b) => {
        if (a > b) return 1;
        if (a < b) return -1;
        return 0;
      })
      .forEach(serviceName => {
        const value = TraceRowData.services[serviceName];
        if (!value) return;

        html += `<span class="stage-traces-table-tag">${serviceName}:</span>
        <span class="stage-traces-table-value">${value}</span>`;
      });

    return html;
  }

  private onKeyDown(e: KeyboardEvent) {
    // If user is typing on any kind of input element which is
    // child of this component, we don't want to trigger shortcuts
    if (e.target instanceof HTMLInputElement) return;

    // CMD + A => Select all
    if (e.key == 'a' && (e.ctrlKey || e.metaKey)) {
      this.table.selectRow();
      return;
    }
  }

  private onStageTraceAdded(trace: Trace) {
    this.updateTraces(this.stage.getAllTraces());
  }

  private onStageTraceRemoved(trace: Trace) {
    this.updateTraces(this.stage.getAllTraces());
  }

  redrawTable(force = false) {
    if (!this.table) return;

    // Tabulator's layout mode `fitDataFill` is a little buggy
    // When the widget is not shown, a new trace is added
    // Row widths are broken. So as a workaround, we will check
    // the first cell's width of some random rows are equal or not
    // If they'are not equal, force re-render the table.
    let forceRerender = force;
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

  deselectAll() {
    this.table.deselectRow();
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
    this.table.setHeight(height);
    this.redrawTable();
  }

  dispose() {
    this.table?.destroy();
    this.table = null;

    // Unbind events
    this.stage.removeListener(
      StageEvent.TRACE_ADDED,
      this.binded.onStageTraceAdded
    );
    this.stage.removeListener(
      StageEvent.TRACE_REMOVED,
      this.binded.onStageTraceRemoved
    );
    this.elements.container.removeEventListener(
      'keydown',
      this.binded.onKeyDown,
      false
    );
  }
}
