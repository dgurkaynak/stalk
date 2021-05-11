import { DataSource } from '../../model/datasource/interfaces';
import { Span } from '../../model/interfaces';
import { Trace } from '../../model/trace';
import {
  DataSourceManager,
  DataSourceManagerEvent,
} from '../../model/datasource/manager';
import Noty from 'noty';
import { ZipkinAPI, ZipkinAPISearchQuery } from '../../model/zipkin';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import {
  TraceSearchResultsTable,
  TraceSearchResultsTableEvent,
  TraceSearchResultsTableRowData,
} from './trace-search-results-table';
import parseDuration from 'parse-duration';
import find from 'lodash/find';
import flatpickr from 'flatpickr';
import {
  TracesScatterPlot,
  TracesScatterPlotEvent,
} from '../traces-scatter-plot/traces-scatter-plot';
import { to } from '../../utils/to';

import SvgCheckCircle from '!!raw-loader!@mdi/svg/svg/check-circle.svg';
import SvgAlert from '!!raw-loader!@mdi/svg/svg/alert.svg';
import SvgAlertCircle from '!!raw-loader!@mdi/svg/svg/alert-circle.svg';
import SvgAlertCircleOutline from '!!raw-loader!@mdi/svg/svg/alert-circle-outline.svg';
import SvgEmoticonSad from '!!raw-loader!@mdi/svg/svg/emoticon-sad-outline.svg';
import SvgEmoticonCool from '!!raw-loader!@mdi/svg/svg/emoticon-cool-outline.svg';
import SvgArrowCollapseLeft from '!!raw-loader!@mdi/svg/svg/arrow-collapse-left.svg';
import SvgArrowCollapseRight from '!!raw-loader!@mdi/svg/svg/arrow-collapse-right.svg';
import './zipkin-search.css';

export interface ZipkinSearchOptions {
  dataSource: DataSource;
  onTracesAdd?: (traces: Trace[]) => void;
}

export enum ZipkinLookbackValue {
  LAST_HOUR = '1h',
  LAST_2_HOURS = '2h',
  LAST_3_HOURS = '3h',
  LAST_6_HOURS = '6h',
  LAST_12_HOURS = '12h',
  LAST_24_HOURS = '24h',
  LAST_2_DAYS = '2d',
  LAST_7_DAYS = '7d',
  CUSTOM = 'custom',
}

const DATE_RANGE_SEPERATOR = ' - ';

export class ZipkinSearch {
  private dsManager = DataSourceManager.getSingleton();
  private api: ZipkinAPI;
  private tracesTable = new TraceSearchResultsTable();
  private tracesScatterPlot = new TracesScatterPlot({
    showStageBoundaries: true,
  });
  private traceResults: Trace[] = [];
  private selectedTraceIds: string[] = [];
  private customLookbackFlatpickr: flatpickr.Instance;
  private isSearchFormHidden = false;
  private elements = {
    container: document.createElement('div'),
    header: {
      statusContainer: document.createElement('span'),
      statusContent: document.createElement('div'),
    },
    mainContainer: document.createElement('div'),
    result: {
      container: document.createElement('div'),
      scatterPlotContainer: document.createElement('div'),
      tableContainer: document.createElement('div'),
      overlayContainer: document.createElement('div'),
    },
    footer: {
      container: document.createElement('div'),
      selectionText: document.createElement('span'),
      addToStageButton: document.createElement('button'),
    },
    searchByTraceId: {
      form: document.createElement('form'),
      input: document.createElement('input'),
      button: document.createElement('button'),
    },
    searchFormToggle: document.createElement('div'),
    search: {
      container: document.createElement('div'),
      form: document.createElement('form'),
      serviceSelect: document.createElement('select'),
      operationSelect: document.createElement('select'),
      tagsInput: document.createElement('input'),
      lookbackSelect: document.createElement('select'),
      customLookbackInput: document.createElement('input'),
      minDurationInput: document.createElement('input'),
      maxDurationInput: document.createElement('input'),
      limitInput: document.createElement('input'),
      button: document.createElement('button'),
    },
  };
  private tippyInstaces: {
    status: TippyInstance;
  };

  private binded = {
    onDataSourceManagerUpdate: this.onDataSourceManagerUpdate.bind(this),
    onSearchByTraceIdFormSubmit: this.onSearchByTraceIdFormSubmit.bind(this),
    onSearcFormSubmit: this.onSearchFormSubmit.bind(this),
    onServiceSelectChange: this.onServiceSelectChange.bind(this),
    onLookbackSelectChange: this.onLookbackSelectChange.bind(this),
    onTableSelectionUpdated: this.onTableSelectionUpdated.bind(this),
    onTableTraceDoubleClicked: this.onTableTraceDoubleClicked.bind(this),
    onAddToStageButtonClick: this.onAddToStageButtonClick.bind(this),
    onTraceScatterPointClick: this.onTraceScatterPointClick.bind(this),
    onStatusClick: this.onStatusClick.bind(this),
    onSearchFormToggleClick: this.onSearchFormToggleClick.bind(this),
  };

  constructor(private options: ZipkinSearchOptions) {
    this.api = this.dsManager.apiFor(this.options.dataSource) as ZipkinAPI;

    // Prepare DOM
    const els = this.elements;
    els.container.classList.add('zipkin-search-modal-content');

    const header = document.createElement('div');
    header.classList.add('header');
    els.container.appendChild(header);

    els.mainContainer.classList.add('main');
    if (this.isSearchFormHidden) {
      els.mainContainer.classList.add('search-form-hidden');
    }
    els.container.appendChild(els.mainContainer);

    els.search.container.classList.add('search-form-container');
    els.mainContainer.appendChild(els.search.container);

    els.searchFormToggle.classList.add('search-form-toggle');
    els.searchFormToggle.innerHTML = this.isSearchFormHidden
      ? SvgArrowCollapseRight
      : SvgArrowCollapseLeft;
    els.mainContainer.appendChild(els.searchFormToggle);

    els.result.container.classList.add('result');
    els.mainContainer.appendChild(els.result.container);

    els.result.scatterPlotContainer.classList.add('scatter-plot-container');
    els.result.container.appendChild(els.result.scatterPlotContainer);

    els.result.tableContainer.classList.add('table-container');
    els.result.container.appendChild(els.result.tableContainer);

    els.footer.container.classList.add('footer');
    els.result.container.appendChild(els.footer.container);

    els.result.overlayContainer.classList.add('overlay-container');
    els.result.container.appendChild(els.result.overlayContainer);
    this.toggleRightPanelOverlay('ready');

    // Header
    const titleContainer = document.createElement('div');
    titleContainer.classList.add('title-container');
    header.appendChild(titleContainer);

    const title = document.createElement('span');
    title.textContent = `API Status:`;
    titleContainer.appendChild(title);

    els.header.statusContainer.classList.add('status');
    titleContainer.appendChild(els.header.statusContainer);

    // Search by trace id
    {
      const { form, input, button } = this.elements.searchByTraceId;
      form.classList.add('search-by-trace-id', 'input-button-group');
      header.appendChild(form);

      input.classList.add('small');
      input.required = true;
      input.placeholder = 'Search by Trace ID...';
      form.appendChild(input);

      button.textContent = 'Search';
      button.type = 'submit';
      button.classList.add('secondary', 'small');
      form.appendChild(button);
    }

    // Normal search
    {
      const {
        form,
        serviceSelect,
        operationSelect,
        tagsInput,
        lookbackSelect,
        customLookbackInput,
        minDurationInput,
        maxDurationInput,
        limitInput,
        button,
      } = this.elements.search;
      els.search.container.appendChild(form);

      const serviceContainer = document.createElement('div');
      serviceContainer.classList.add('field');
      form.appendChild(serviceContainer);
      const serviceTitleContainer = document.createElement('div');
      serviceTitleContainer.textContent = 'Service';
      serviceTitleContainer.classList.add('field-title');
      serviceContainer.appendChild(serviceTitleContainer);
      serviceSelect.classList.add('small');
      serviceSelect.required = true;
      serviceContainer.appendChild(serviceSelect);

      const operationContainer = document.createElement('div');
      operationContainer.classList.add('field');
      form.appendChild(operationContainer);
      const operationTitleContainer = document.createElement('div');
      operationTitleContainer.textContent = 'Operation';
      operationTitleContainer.classList.add('field-title');
      operationContainer.appendChild(operationTitleContainer);
      operationSelect.classList.add('small');
      operationSelect.required = true;
      operationContainer.appendChild(operationSelect);

      const tagsContainer = document.createElement('div');
      tagsContainer.classList.add('field');
      form.appendChild(tagsContainer);
      const tagsTitleContainer = document.createElement('div');
      tagsTitleContainer.textContent = 'Tags';
      tagsTitleContainer.classList.add('field-title');
      tagsContainer.appendChild(tagsTitleContainer);
      tagsInput.classList.add('small');
      tagsInput.placeholder = 'http.uri=/foo and retried';
      tagsContainer.appendChild(tagsInput);

      const lookbackContainer = document.createElement('div');
      lookbackContainer.classList.add('field');
      form.appendChild(lookbackContainer);
      const lookbackTitleContainer = document.createElement('div');
      lookbackTitleContainer.textContent = 'Lookback';
      lookbackTitleContainer.classList.add('field-title');
      lookbackContainer.appendChild(lookbackTitleContainer);
      lookbackSelect.classList.add('small');
      lookbackSelect.required = true;
      lookbackContainer.appendChild(lookbackSelect);

      lookbackSelect.innerHTML = `<option value="${ZipkinLookbackValue.LAST_HOUR}">Last Hour</option>
      <option value="${ZipkinLookbackValue.LAST_2_HOURS}">Last 2 Hours</option>
      <option value="${ZipkinLookbackValue.LAST_3_HOURS}">Last 3 Hours</option>
      <option value="${ZipkinLookbackValue.LAST_6_HOURS}">Last 6 Hours</option>
      <option value="${ZipkinLookbackValue.LAST_12_HOURS}">Last 12 Hours</option>
      <option value="${ZipkinLookbackValue.LAST_24_HOURS}">Last 24 Hours</option>
      <option value="${ZipkinLookbackValue.LAST_2_DAYS}">Last 2 Days</option>
      <option value="${ZipkinLookbackValue.LAST_7_DAYS}">Last 7 Days</option>
      <option value="${ZipkinLookbackValue.CUSTOM}">Custom</option>`;

      lookbackContainer.appendChild(customLookbackInput);

      const minDurationContainer = document.createElement('div');
      minDurationContainer.classList.add('field');
      form.appendChild(minDurationContainer);
      const minDurationTitleContainer = document.createElement('div');
      minDurationTitleContainer.textContent = 'Min Duration';
      minDurationTitleContainer.classList.add('field-title');
      minDurationContainer.appendChild(minDurationTitleContainer);
      minDurationInput.classList.add('small');
      minDurationInput.placeholder = 'e.g. 1.2s, 100ms, 500us';
      minDurationContainer.appendChild(minDurationInput);

      const maxDurationContainer = document.createElement('div');
      maxDurationContainer.classList.add('field');
      form.appendChild(maxDurationContainer);
      const maxDurationTitleContainer = document.createElement('div');
      maxDurationTitleContainer.textContent = 'Max Duration';
      maxDurationTitleContainer.classList.add('field-title');
      maxDurationContainer.appendChild(maxDurationTitleContainer);
      maxDurationInput.classList.add('small');
      maxDurationInput.placeholder = 'e.g. 1.2s, 100ms, 500us';
      maxDurationContainer.appendChild(maxDurationInput);

      const limitContainer = document.createElement('div');
      limitContainer.classList.add('field');
      form.appendChild(limitContainer);
      const limitTitleContainer = document.createElement('div');
      limitTitleContainer.textContent = 'Limit';
      limitTitleContainer.classList.add('field-title');
      limitContainer.appendChild(limitTitleContainer);
      limitInput.classList.add('small');
      limitInput.type = 'number';
      limitInput.min = '1';
      limitInput.value = '100';
      limitInput.required = true;
      limitContainer.appendChild(limitInput);

      button.textContent = 'Search';
      button.type = 'submit';
      button.classList.add('secondary', 'small');
      form.appendChild(button);
    }

    // Bottom
    {
      els.footer.selectionText.innerHTML = 'No trace selected';
      els.footer.container.appendChild(els.footer.selectionText);

      els.footer.addToStageButton.classList.add('primary', 'small');
      els.footer.addToStageButton.textContent = 'Add to Stage';
      els.footer.addToStageButton.disabled = true;
      els.footer.container.appendChild(els.footer.addToStageButton);
    }
  }

  init() {
    this.initTippyInstances();

    // Bind events
    this.dsManager.on(
      DataSourceManagerEvent.UPDATED,
      this.binded.onDataSourceManagerUpdate
    );
    this.tracesTable.on(
      TraceSearchResultsTableEvent.SELECTIONS_UPDATED,
      this.binded.onTableSelectionUpdated
    );
    this.tracesTable.on(
      TraceSearchResultsTableEvent.TRACE_DOUBLE_CLICKED,
      this.binded.onTableTraceDoubleClicked
    );
    this.elements.header.statusContainer.addEventListener(
      'click',
      this.binded.onStatusClick,
      false
    );
    this.elements.searchByTraceId.form.addEventListener(
      'submit',
      this.binded.onSearchByTraceIdFormSubmit,
      false
    );
    this.elements.searchFormToggle.addEventListener(
      'click',
      this.binded.onSearchFormToggleClick,
      false
    );
    this.elements.search.form.addEventListener(
      'submit',
      this.binded.onSearcFormSubmit,
      false
    );
    this.elements.search.serviceSelect.addEventListener(
      'change',
      this.binded.onServiceSelectChange,
      false
    );
    this.elements.search.lookbackSelect.addEventListener(
      'change',
      this.binded.onLookbackSelectChange,
      false
    );
    this.elements.footer.addToStageButton.addEventListener(
      'click',
      this.binded.onAddToStageButtonClick,
      false
    );

    // Date range picker
    this.customLookbackFlatpickr = flatpickr(
      this.elements.search.customLookbackInput,
      {
        mode: 'range',
        enableTime: true,
        time_24hr: true,
        dateFormat: 'Z',
        altInput: true,
        altFormat: 'M d, H:i',
        locale: {
          rangeSeparator: DATE_RANGE_SEPERATOR,
          firstDayOfWeek: 1,
        } as any,
      }
    );
    // Initially hide custom date inputs
    this.onLookbackSelectChange();

    // Traces table
    // In order to get offsetWidth and height, the dom must be rendered
    // So before calling this `init()` method, ensure that dom is rendered.
    const { tableContainer } = this.elements.result;
    this.tracesTable.mount(tableContainer);
    this.tracesTable.init({
      width: tableContainer.offsetWidth,
      height: tableContainer.offsetHeight,
      showInStageColumn: true,
      indicateTracesOverlappingWithStage: true,
    });

    // Traces scatter plot
    const { scatterPlotContainer } = this.elements.result;
    this.tracesScatterPlot.mount(scatterPlotContainer);
    this.tracesScatterPlot.init({
      width: scatterPlotContainer.offsetWidth,
      height: scatterPlotContainer.offsetHeight,
    });
    this.tracesScatterPlot.on(
      TracesScatterPlotEvent.POINT_CLICKED,
      this.binded.onTraceScatterPointClick
    );
  }

  private initTippyInstances() {
    this.tippyInstaces = {
      status: tippy(this.elements.header.statusContainer, {
        delay: 0,
        duration: 0,
        updateDuration: 0,
        content: this.elements.header.statusContent,
        theme: 'tooltip',
        placement: 'top',
      }),
    };
  }

  private async testApiAndFetchServices() {
    const els = this.elements;

    els.header.statusContainer.classList.remove('success', 'error', 'warning');
    els.header.statusContainer.innerHTML = `<div class="sk-circle">
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
    els.header.statusContent.textContent = 'Testing the API...';

    // Test api
    const [testErr] = await to(this.api.test());
    if (testErr) {
      els.header.statusContainer.classList.add('error');
      els.header.statusContainer.innerHTML = SvgAlertCircle;
      els.header.statusContent.textContent = testErr.message;
      return;
    }

    // Get services
    const [getErr, response] = await to(this.api.getServices());
    if (getErr) {
      els.header.statusContainer.classList.add('error');
      els.header.statusContainer.innerHTML = SvgAlertCircle;
      els.header.statusContent.textContent = `Could not get services from API: "${getErr.message}"`;
      return;
    }

    if (!response || !response.length) {
      els.header.statusContainer.classList.add('warning');
      els.header.statusContainer.innerHTML = SvgAlert;
      els.header.statusContent.textContent = `There is no services found`;
      return;
    }

    const serviceNames: string[] = response.sort();
    this.elements.search.serviceSelect.innerHTML = serviceNames
      .map((s) => `<option value="${s}">${s}</option>`)
      .join('');

    const currentValue = this.elements.search.serviceSelect.value;
    if (serviceNames.indexOf(currentValue) > -1) {
      this.elements.search.serviceSelect.value = currentValue;
    }

    this.updateOperationsSelect();

    els.header.statusContainer.classList.add('success');
    els.header.statusContainer.innerHTML = SvgCheckCircle;
    els.header.statusContent.textContent = 'API is OK';
  }

  onShow() {
    const { tableContainer, scatterPlotContainer } = this.elements.result;
    this.tracesScatterPlot.resize(
      scatterPlotContainer.offsetWidth,
      scatterPlotContainer.offsetHeight
    );
    this.tracesTable.resize(
      tableContainer.offsetWidth,
      tableContainer.offsetHeight
    );
    this.tracesTable.redrawTable(true);

    this.testApiAndFetchServices();
  }

  private async updateOperationsSelect() {
    const serviceName = this.elements.search.serviceSelect.value;
    const currentValue = this.elements.search.operationSelect.value;

    try {
      const response = await this.api.getSpans(serviceName);
      const operationNames: string[] = ['all', ...response.sort()];
      this.elements.search.operationSelect.innerHTML = operationNames
        .map((o) => `<option value="${o}">${o}</option>`)
        .join('');

      if (operationNames.indexOf(currentValue) > -1) {
        this.elements.search.operationSelect.value = currentValue;
      }
    } catch (err) {
      new Noty({
        text: `Could not fetch operations from API: "${err.message}"`,
        type: 'error',
      }).show();
    }
  }

  private onDataSourceManagerUpdate(ds: DataSource) {
    if (ds.id != this.options.dataSource.id) return;
    this.options.dataSource = ds;
    this.api = this.dsManager.apiFor(ds) as ZipkinAPI;
  }

  private async onSearchByTraceIdFormSubmit(e: Event) {
    e.preventDefault();

    this.traceResults = [];
    this.elements.searchByTraceId.button.disabled = true;
    this.toggleRightPanelOverlay('loading');

    try {
      const formEl = this.elements.searchByTraceId;

      const traceSpans: Span[] = await this.api.getTrace(formEl.input.value);

      this.traceResults = traceSpans.length > 0 ? [new Trace(traceSpans)] : [];
      this.tracesScatterPlot.setTraces(this.traceResults);
      this.tracesTable.updateTraces(this.traceResults);

      this.toggleRightPanelOverlay(
        this.traceResults.length == 0 ? 'no-results' : false
      );

      window.Countly &&
        window.Countly.add_event({
          key: 'trace_searched_by_id',
          count: 1,
          segmentation: {
            type: 'zipkin',
            resultCount: this.traceResults.length,
          },
        });
    } catch (err) {
      this.toggleRightPanelOverlay('error', err.message);

      window.Countly &&
        window.Countly.add_event({
          key: 'trace_search_by_id_error',
          count: 1,
          segmentation: {
            type: 'zipkin',
            message: err.message,
          },
        });
    }

    this.elements.searchByTraceId.button.disabled = false;
  }

  private async onSearchFormSubmit(e: Event) {
    e.preventDefault();

    this.traceResults = [];
    this.elements.search.button.disabled = true;
    this.toggleRightPanelOverlay('loading');

    try {
      const formEl = this.elements.search;
      const query: ZipkinAPISearchQuery = {
        serviceName: formEl.serviceSelect.value,
      };

      if (
        formEl.operationSelect.value &&
        formEl.operationSelect.value != 'all'
      ) {
        query.spanName = formEl.operationSelect.value;
      }

      if (formEl.tagsInput.value) {
        query.annotationQuery = formEl.tagsInput.value;
      }

      if (formEl.lookbackSelect.value == ZipkinLookbackValue.CUSTOM) {
        const dateRangeValue = this.customLookbackFlatpickr.input.value.trim();
        const parts = dateRangeValue.split(DATE_RANGE_SEPERATOR);
        if (parts.length != 2) {
          throw new Error(`Unsupported custom lookback`);
        }
        query.endTs = new Date(parts[1]).getTime();
        query.lookback = query.endTs - new Date(parts[0]).getTime();
      } else {
        const duration = parseDuration(formEl.lookbackSelect.value);
        query.endTs = Date.now();
        query.lookback = duration;
      }

      if (formEl.minDurationInput.value) {
        query.minDuration = parseDuration(formEl.minDurationInput.value) * 1000;
      }

      if (formEl.maxDurationInput.value) {
        query.maxDuration = parseDuration(formEl.maxDurationInput.value) * 1000;
      }

      const limitIntValue = parseInt(formEl.limitInput.value, 10);
      if (isNaN(limitIntValue)) {
        throw new Error(`Unsupported limit value`);
      }
      query.limit = limitIntValue;

      const traceSpans: Span[][] = await this.api.search(query);
      this.traceResults = traceSpans.map((spans) => new Trace(spans));
      this.tracesScatterPlot.setTraces(this.traceResults);
      this.tracesTable.updateTraces(this.traceResults);

      this.toggleRightPanelOverlay(
        this.traceResults.length == 0 ? 'no-results' : false
      );

      window.Countly &&
        window.Countly.add_event({
          key: 'trace_searched',
          count: 1,
          segmentation: {
            type: 'zipkin',
            resultCount: this.traceResults.length,
          },
        });
    } catch (err) {
      this.toggleRightPanelOverlay('error', err.message);

      window.Countly &&
        window.Countly.add_event({
          key: 'trace_search_error',
          count: 1,
          segmentation: {
            type: 'zipkin',
            message: err.message,
          },
        });
    }

    this.elements.search.button.disabled = false;
  }

  private onServiceSelectChange() {
    this.updateOperationsSelect();
  }

  private onLookbackSelectChange() {
    if (
      this.elements.search.lookbackSelect.value == ZipkinLookbackValue.CUSTOM
    ) {
      this.customLookbackFlatpickr.altInput.style.display = '';
      this.customLookbackFlatpickr.open();
    } else {
      this.customLookbackFlatpickr.altInput.style.display = 'none';
    }
  }

  resize() {
    const { tableContainer, scatterPlotContainer } = this.elements.result;
    this.tracesScatterPlot.resize(
      scatterPlotContainer.offsetWidth,
      scatterPlotContainer.offsetHeight
    );
    this.tracesTable.resize(
      tableContainer.offsetWidth,
      tableContainer.offsetHeight
    );
  }

  private async onTableSelectionUpdated(
    selectedTraces: TraceSearchResultsTableRowData[]
  ) {
    // When we try to redraw tabulator while it's already redrawing,
    // it gives an error. So, we apply the most famous javascript workaround ever.
    // await new Promise(resolve => setTimeout(resolve, 0));
    this.selectedTraceIds = selectedTraces.map((t) => t.id);

    if (selectedTraces.length == 0) {
      this.elements.footer.addToStageButton.disabled = true;
      this.elements.footer.selectionText.textContent = 'No trace selected';
      return;
    }

    let text = `${selectedTraces.length} traces`;
    if (selectedTraces.length == 1) {
      text = `1 trace`;
    }
    this.elements.footer.selectionText.innerHTML = `<strong>${text}</strong> selected`;
    this.elements.footer.addToStageButton.disabled = false;
  }

  private async onTableTraceDoubleClicked(
    trace: TraceSearchResultsTableRowData
  ) {
    const traces = this.traceResults.filter((t) => t.id == trace.id);
    this.options.onTracesAdd?.(traces);
    this.tracesTable.selectTrace(null);
    this.reloadTableData();
  }

  private onAddToStageButtonClick() {
    const traces = this.selectedTraceIds.map((traceId) => {
      return find(this.traceResults, (t) => t.id == traceId);
    });
    this.options.onTracesAdd?.(traces);
    this.tracesTable.selectTrace(null);
    this.reloadTableData();
  }

  private onTraceScatterPointClick(trace: Trace) {
    this.tracesTable.selectTrace(trace.id);
    this.tracesTable.focusTrace(trace.id);
  }

  private onStatusClick() {
    this.testApiAndFetchServices();
  }

  reloadTableData() {
    this.tracesTable.reloadData();
  }

  private onSearchFormToggleClick() {
    const els = this.elements;
    this.isSearchFormHidden = !this.isSearchFormHidden;

    if (this.isSearchFormHidden) {
      els.mainContainer.classList.add('search-form-hidden');
      els.searchFormToggle.innerHTML = SvgArrowCollapseRight;
    } else {
      els.mainContainer.classList.remove('search-form-hidden');
      els.searchFormToggle.innerHTML = SvgArrowCollapseLeft;
    }

    this.resize();
  }

  private toggleRightPanelOverlay(
    type: 'ready' | 'loading' | 'no-results' | 'error' | false,
    errorMessage?: string
  ) {
    const { overlayContainer } = this.elements.result;

    if (!type) {
      overlayContainer.style.display = 'none';
      return;
    }

    if (type == 'loading') {
      // Borrowed from https://tobiasahlin.com/spinkit/
      overlayContainer.innerHTML = `<div class="sk-circle">
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
      overlayContainer.style.display = '';
      return;
    }

    if (type == 'no-results') {
      overlayContainer.innerHTML = `<div class="message">
        ${SvgEmoticonSad}
        <span>No results found</span>
      </div>`;
      overlayContainer.style.display = '';
      return;
    }

    if (type == 'ready') {
      overlayContainer.innerHTML = `<div class="message">
        ${SvgEmoticonCool}
        <span>Ready to search traces</span>
      </div>`;
      overlayContainer.style.display = '';
      return;
    }

    if (type == 'error') {
      overlayContainer.innerHTML = `<div class="message">
        ${SvgAlertCircleOutline}
        <span>${errorMessage}</span>
      </div>`;
      overlayContainer.style.display = '';
      return;
    }
  }

  getElement() {
    return this.elements.container;
  }

  dispose() {
    this.dsManager.removeListener(
      DataSourceManagerEvent.UPDATED,
      this.binded.onDataSourceManagerUpdate
    );
    this.tracesTable.removeListener(
      TraceSearchResultsTableEvent.SELECTIONS_UPDATED,
      this.binded.onTableSelectionUpdated
    );
    this.tracesTable.removeListener(
      TraceSearchResultsTableEvent.TRACE_DOUBLE_CLICKED,
      this.binded.onTableTraceDoubleClicked
    );
    this.elements.header.statusContainer.removeEventListener(
      'click',
      this.binded.onStatusClick,
      false
    );
    this.elements.searchByTraceId.form.removeEventListener(
      'submit',
      this.binded.onSearchByTraceIdFormSubmit,
      false
    );
    this.elements.search.form.removeEventListener(
      'submit',
      this.binded.onSearcFormSubmit,
      false
    );
    this.elements.search.serviceSelect.removeEventListener(
      'change',
      this.binded.onServiceSelectChange,
      false
    );
    this.elements.search.lookbackSelect.removeEventListener(
      'change',
      this.binded.onLookbackSelectChange,
      false
    );
    this.elements.footer.addToStageButton.removeEventListener(
      'click',
      this.binded.onAddToStageButtonClick,
      false
    );
    this.elements.searchFormToggle.removeEventListener(
      'click',
      this.binded.onSearchFormToggleClick,
      false
    );
    this.tracesScatterPlot.removeListener(
      TracesScatterPlotEvent.POINT_CLICKED,
      this.binded.onTraceScatterPointClick
    );

    Object.values(this.tippyInstaces).forEach((t) => t.destroy());
    this.tracesTable.dispose();
    this.tracesScatterPlot.dispose();
    this.customLookbackFlatpickr.destroy();
  }
}
