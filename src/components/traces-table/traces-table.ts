import { Trace } from '../../model/trace';
import { formatMicroseconds } from '../../utils/format-microseconds';
import * as Tabulator from 'tabulator-tables';
import sampleSize from 'lodash/sampleSize';
import cloneDeep from 'lodash/cloneDeep';
import EventEmitter from 'events';

import 'tabulator-tables/dist/css/tabulator_simple.min.css';
import './traces-table.css';

export interface TraceRowData {
  id: string;
  startTime: number;
  duration: number;
  name: string;
  spanCount: number;
  errorCount: number;
  services: { [key: string]: number };
}

export enum TracesTableViewEvent {
  SELECTIONS_UPDATED = 'selections_updated'
}

export class TracesTableView extends EventEmitter {
  private table: Tabulator;
  private traceRows: TraceRowData[] = [];

  private elements = {
    container: document.createElement('div'),
    tableContainer: document.createElement('div'),
    loadingContainer: document.createElement('div')
  };
  private viewPropertiesCache = {
    width: 0,
    height: 0
  };

  private binded = {
    formatTimestamp: this.formatTimestamp.bind(this),
    formatDuration: this.formatDuration.bind(this),
    formatServices: this.formatServices.bind(this),
    rowSelectionChanged: this.rowSelectionChanged.bind(this)
  };

  private columnDefinitions = {
    id: {
      title: 'Id',
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

    const { container, tableContainer, loadingContainer } = this.elements;
    container.classList.add('traces-table-view');
    container.appendChild(tableContainer);

    loadingContainer.classList.add('loading-container');
    // Borrowed from https://tobiasahlin.com/spinkit/
    loadingContainer.innerHTML = `<div class="sk-circle">
      <div class="sk-circle1 sk-child"></div>
      <div class="sk-circle2 sk-child"></div>
      <div class="sk-circle3 sk-child"></div>
      <div class="sk-circle4 sk-child"></div>
      <div class="sk-circle5 sk-child"></div>
      <div class="sk-circle6 sk-child"></div>
      <div class="sk-circle7 sk-child"></div>
      <div class="sk-circle8 sk-child"></div>
      <div class="sk-circle9 sk-child"></div>
      <div class="sk-circle10 sk-child"></div>
      <div class="sk-circle11 sk-child"></div>
      <div class="sk-circle12 sk-child"></div>
    </div>`;
    this.toggleLoading(false);
    container.appendChild(loadingContainer);
  }

  init(options: { width: number; height: number }) {
    this.viewPropertiesCache = {
      width: options.width,
      height: options.height
    };

    // Init table
    this.table = new Tabulator(this.elements.tableContainer, {
      autoResize: false, // This causes to lose focus when widget is hidden
      height: this.viewPropertiesCache.height,
      data: this.traceRows,
      layout: 'fitDataFill',
      movableColumns: true,
      selectable: true,
      columns: [
        this.columnDefinitions.startTime,
        // this.columnDefinitions.id,
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
      keybindings: false
    });
  }

  async updateTraces(traces: Trace[]) {
    this.traceRows = traces.map(t => this.trace2RowData(t));
    await this.table.replaceData(this.traceRows);
  }

  private rowSelectionChanged(data: any, rows: any) {
    console.log('rowSelectionChanged', { data, rows });
  }

  private trace2RowData(trace: Trace) {
    return {
      id: trace.id,
      startTime: trace.startTime,
      duration: trace.duration,
      name: trace.name,
      spanCount: trace.spanCount,
      errorCount: trace.errorCount,
      services: cloneDeep(trace.spanCountsByService)
    };
  }

  private formatTimestamp(cell: any) {
    // TODO: Human readable date time
    return cell.getValue();
  }

  private formatDuration(cell: any) {
    return formatMicroseconds(cell.getValue());
  }

  private formatServices(cell: any) {
    const TraceRowData = cell.getRow().getData();
    let html = '';

    // TODO: Sort these with occurance frequency
    Object.keys(TraceRowData.services)
      .sort((a, b) => {
        if (a > b) return 1;
        if (a < b) return -1;
        return 0;
      })
      .forEach(serviceName => {
        const value = TraceRowData.services[serviceName];
        if (!value) return;

        html += `<span class="traces-table-tag">${serviceName}:</span>
        <span class="traces-table-value">${value}</span>`;
      });

    return html;
  }

  toggleLoading(shouldShow: boolean) {
    if (shouldShow) {
      this.elements.loadingContainer.style.display = '';
      return;
    }

    this.elements.loadingContainer.style.display = 'none';
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
  }
}
