import { Trace } from '../../model/trace';
import { Stage } from '../../model/stage';
import { formatMicroseconds } from '../../utils/format-microseconds';
import * as Tabulator from 'tabulator-tables';
import find from 'lodash/find';
import sampleSize from 'lodash/sampleSize';
import cloneDeep from 'lodash/cloneDeep';
import EventEmitter from 'events';
import format from 'date-fns/format';

import SvgCheckCircle from '!!raw-loader!@mdi/svg/svg/check-circle.svg';
import SvgAlert from '!!raw-loader!@mdi/svg/svg/alert.svg';
import 'tabulator-tables/dist/css/tabulator_simple.min.css';
import './search-modal-traces-table.css';

export interface SearchModalTraceRowData {
  id: string;
  startTime: number;
  finishTime: number;
  duration: number;
  name: string;
  spanCount: number;
  errorCount: number;
  services: { [key: string]: number };
}

export interface SearchModalTracesTableOptions {
  width: number;
  height: number;
  showInStageColumn?: boolean;
  indicateTracesOverlappingWithStage?: boolean;
  footerElement?: HTMLElement;
  placeholderElement?: HTMLElement;
}

export enum SearchModalTracesTableViewEvent {
  SELECTIONS_UPDATED = 'selections_updated',
  TRACE_DOUBLE_CLICKED = 'trace_double_clicked',
}

export class SearchModalTracesTableView extends EventEmitter {
  private stage = Stage.getSingleton();
  private options: SearchModalTracesTableOptions;
  private table: Tabulator;
  private traceRows: SearchModalTraceRowData[] = [];

  private elements = {
    container: document.createElement('div'),
    tableContainer: document.createElement('div'),
    loadingContainer: document.createElement('div'),
  };
  private viewPropertiesCache = {
    width: 0,
    height: 0,
  };

  private binded = {
    formatTimestamp: this.formatTimestamp.bind(this),
    formatDuration: this.formatDuration.bind(this),
    formatServices: this.formatServices.bind(this),
    formatInStage: this.formatInStage.bind(this),
    rowSelectionChanged: this.rowSelectionChanged.bind(this),
    rowDblClick: this.rowDblClick.bind(this),
    rowFormatter: this.rowFormatter.bind(this),
    onKeyDown: this.onKeyDown.bind(this),
  };

  private columnDefinitions = {
    inStage: {
      title: '',
      field: 'inStage',
      formatter: this.binded.formatInStage,
      headerSort: false,
    } as Tabulator.ColumnDefinition,
    id: {
      title: 'Id',
      field: 'id',
    } as Tabulator.ColumnDefinition,
    startTime: {
      title: 'Date',
      field: 'startTime',
      formatter: this.binded.formatTimestamp,
    } as Tabulator.ColumnDefinition,
    duration: {
      title: 'Duration',
      field: 'duration',
      formatter: this.binded.formatDuration,
    } as Tabulator.ColumnDefinition,
    name: {
      title: 'Root Span',
      field: 'name',
    } as Tabulator.ColumnDefinition,
    spanCount: {
      title: 'Span(s)',
      field: 'spanCount',
    } as Tabulator.ColumnDefinition,
    errorCount: {
      title: 'Error(s)',
      field: 'errorCount',
    } as Tabulator.ColumnDefinition,
    services: {
      title: 'Services & Span(s)',
      field: 'services',
      formatter: this.binded.formatServices,
      headerSort: false,
    } as Tabulator.ColumnDefinition,
  };

  constructor() {
    super();

    const { container, tableContainer, loadingContainer } = this.elements;
    container.classList.add('search-modal-traces-table-view');
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

  init(options: SearchModalTracesTableOptions) {
    this.options = options;
    this.viewPropertiesCache = {
      width: options.width,
      height: options.height,
    };

    // Bind events
    this.elements.container.addEventListener(
      'keydown',
      this.binded.onKeyDown,
      false
    );

    const columns: Tabulator.ColumnDefinition[] = [];
    if (this.options.showInStageColumn) {
      columns.push(this.columnDefinitions.inStage);
    }
    columns.push(
      ...[
        this.columnDefinitions.startTime,
        // this.columnDefinitions.id,
        this.columnDefinitions.name,
        this.columnDefinitions.duration,
        this.columnDefinitions.spanCount,
        this.columnDefinitions.errorCount,
        this.columnDefinitions.services,
      ]
    );

    // Init table
    this.table = new Tabulator(this.elements.tableContainer, {
      autoResize: false, // This causes to lose focus when widget is hidden
      height: this.viewPropertiesCache.height,
      data: this.traceRows,
      layout: 'fitDataFill',
      movableColumns: true,
      selectable: true,
      columns,
      initialSort: [
        { column: this.columnDefinitions.startTime.field, dir: 'desc' },
      ],
      rowFormatter: this.binded.rowFormatter,
      rowSelectionChanged: this.binded.rowSelectionChanged,
      rowDblClick: this.binded.rowDblClick,
      selectableRangeMode: 'click',
      keybindings: false,
      footerElement: this.options.footerElement,
      placeholder: this.options.placeholderElement,
    });
  }

  async updateTraces(traces: Trace[]) {
    this.traceRows = traces.map((t) => this.trace2RowData(t));
    await this.table.replaceData(this.traceRows);
  }

  private rowSelectionChanged(data: any, rows: any) {
    this.emit(SearchModalTracesTableViewEvent.SELECTIONS_UPDATED, data);
  }

  private rowDblClick(e: MouseEvent, row: any) {
    const data: SearchModalTraceRowData = row.getData();
    this.emit(SearchModalTracesTableViewEvent.TRACE_DOUBLE_CLICKED, data);
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
      services: cloneDeep(trace.spanCountsByService),
    };
  }

  private formatTimestamp(cell: any) {
    return format(cell.getValue() / 1000, 'MMM dd, HH:mm:ss.SSS');
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
      .forEach((serviceName) => {
        const value = TraceRowData.services[serviceName];
        if (!value) return;

        html += `<span class="traces-table-tag">${serviceName}:</span>
        <span class="traces-table-value">${value}</span>`;
      });

    return html;
  }

  private formatInStage(cell: any) {
    const traceRowData = cell.getRow().getData();
    let html = '';

    const traceInStage = find(
      this.stage.getAllTraces(),
      (t) => t.id == traceRowData.id
    );

    if (!traceInStage) {
      return html;
    }

    if (traceInStage.spanCount == traceRowData.spanCount) {
      html = `<div class="in-stage-cell check" title="Trace is already in the stage">${SvgCheckCircle}</div>`;
    } else {
      html = `<div class="in-stage-cell alert" title="Trace has been updated since it was added to stage">${SvgAlert}</div>`;
    }

    return html;
  }

  private rowFormatter(row: any) {
    const trace = row.getData();
    const rowEl = row.getElement();

    if (this.options.indicateTracesOverlappingWithStage) {
      if (this.stage.getAllTraces().length > 0) {
        const stageInterval = {
          start: this.stage.startTimestamp,
          end: this.stage.finishTimestamp,
        };
        const traceInterval = { start: trace.startTime, end: trace.finishTime };

        if (areIntervalsOverlapping(traceInterval, stageInterval)) {
          rowEl.style.fontWeight = '700';
        } else {
          rowEl.style.fontWeight = '';
        }
      } else {
        rowEl.style.fontWeight = '';
      }
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    // If user is typing on any kind of input element which is
    // child of this component, we don't want to trigger shortcuts
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    // CMD + A => Select all
    if (e.key == 'a' && (e.ctrlKey || e.metaKey)) {
      this.table.selectRow();
      return;
    }

    // ESC key => deselect all
    if (e.which == 27) {
      const selectedRows = this.table.getSelectedRows();
      if (selectedRows.length == 0) return;
      this.selectTrace(null);
      e.stopPropagation(); // for modal closing
      return;
    }
  }

  toggleLoading(shouldShow: boolean) {
    if (shouldShow) {
      this.elements.loadingContainer.style.display = '';
      return;
    }

    this.elements.loadingContainer.style.display = 'none';
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
        (el) => el.offsetWidth === widthOfFirstCell
      );
      if (!areEqual) forceRerender = true;
    }

    this.table.redraw(forceRerender);
  }

  selectTrace(traceId: string) {
    if (!traceId) {
      this.table.deselectRow();
      return;
    }

    const row = this.table.getRow(traceId);
    if (!row) {
      this.table.deselectRow();
      return;
    }

    this.table.deselectRow();
    row.select();
  }

  focusTrace(traceId: string) {
    const row = this.table.getRow(traceId);
    if (!row) return;
    this.table.scrollToRow(traceId);
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

    this.elements.container.removeEventListener(
      'keydown',
      this.binded.onKeyDown,
      false
    );
  }
}

function areIntervalsOverlapping(
  a: { start: number; end: number },
  b: { start: number; end: number }
) {
  return a.start <= b.end && b.start <= a.end;
}
