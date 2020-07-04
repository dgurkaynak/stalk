import { DataSourceType, DataSource } from '../../model/datasource/interfaces';
import { Span } from '../../model/interfaces';
import { Trace } from '../../model/trace';
import {
  DataSourceManager,
  DataSourceManagerEvent
} from '../../model/datasource/manager';
import { ModalManager } from '../ui/modal/modal-manager';
import Noty from 'noty';
import { JaegerAPI, JaegerAPISearchQuery } from '../../model/jaeger';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import {
  SearchModalTracesTableView,
  SearchModalTracesTableViewEvent,
  SearchModalTraceRowData
} from './search-modal-traces-table';
import parseDuration from 'parse-duration';
import throttle from 'lodash/throttle';
import find from 'lodash/find';
import flatpickr from 'flatpickr';
import { TracesScatterPlot } from '../traces-scatter-plot/traces-scatter-plot';

import SvgCircleMedium from '!!raw-loader!@mdi/svg/svg/circle-small.svg';
import SvgCheckCircle from '!!raw-loader!@mdi/svg/svg/check-circle.svg';
import SvgAlertCircle from '!!raw-loader!@mdi/svg/svg/alert-circle.svg';
import SvgAlertCircleOutline from '!!raw-loader!@mdi/svg/svg/alert-circle-outline.svg';
import SvgEmoticonSad from '!!raw-loader!@mdi/svg/svg/emoticon-sad-outline.svg';
import SvgEmoticonCool from '!!raw-loader!@mdi/svg/svg/emoticon-cool-outline.svg';
import './jaeger-search-modal-content.css';

export interface JaegerSearchModalContentOptions {
  dataSource: DataSource;
}

export enum JaegerLookbackValue {
  LAST_HOUR = '1h',
  LAST_2_HOURS = '2h',
  LAST_3_HOURS = '3h',
  LAST_6_HOURS = '6h',
  LAST_12_HOURS = '12h',
  LAST_24_HOURS = '24h',
  LAST_2_DAYS = '2d',
  LAST_7_DAYS = '7d',
  CUSTOM = 'custom'
}

const DATE_RANGE_SEPERATOR = ' - ';

export class JaegerSearchModalContent {
  private dsManager = DataSourceManager.getSingleton();
  private api: JaegerAPI;
  private tracesTable = new SearchModalTracesTableView();
  private tracesScatterPlot = new TracesScatterPlot();
  private traceResults: Trace[] = [];
  private selectedTraceIds: string[] = [];
  private customLookbackFlatpickr: flatpickr.Instance;
  private elements = {
    container: document.createElement('div'),
    leftContainer: document.createElement('div'),
    right: {
      container: document.createElement('div'),
      scatterPlotContainer: document.createElement('div'),
      tableContainer: document.createElement('div'),
      overlayContainer: document.createElement('div')
    },
    statusContainer: document.createElement('span'),
    statusContent: document.createElement('div'),
    bottom: {
      container: document.createElement('div'),
      selectionText: document.createElement('div'),
      addToStageButton: document.createElement('button')
    },
    searchByTraceId: {
      form: document.createElement('form'),
      input: document.createElement('input'),
      button: document.createElement('button')
    },
    search: {
      form: document.createElement('form'),
      serviceSelect: document.createElement('select'),
      operationSelect: document.createElement('select'),
      tagsInput: document.createElement('input'),
      lookbackSelect: document.createElement('select'),
      customLookbackInput: document.createElement('input'),
      minDurationInput: document.createElement('input'),
      maxDurationInput: document.createElement('input'),
      limitInput: document.createElement('input'),
      button: document.createElement('button')
    }
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
    onWindowResize: throttle(this.onWindowResize.bind(this), 100),
    onTableSelectionUpdated: this.onTableSelectionUpdated.bind(this),
    onAddToStageButtonClick: this.onAddToStageButtonClick.bind(this)
  };

  constructor(private options: JaegerSearchModalContentOptions) {
    this.api = this.dsManager.apiFor(this.options.dataSource) as JaegerAPI;

    // Prepare DOM
    const els = this.elements;
    els.container.classList.add('jaeger-search-modal-content');

    const topContainer = document.createElement('div');
    topContainer.classList.add('top');
    els.container.appendChild(topContainer);

    els.bottom.container.classList.add('bottom');
    els.container.appendChild(els.bottom.container);

    els.leftContainer.classList.add('left');
    topContainer.appendChild(els.leftContainer);

    els.right.container.classList.add('right');
    topContainer.appendChild(els.right.container);

    els.right.scatterPlotContainer.classList.add('scatter-plot-container');
    els.right.container.appendChild(els.right.scatterPlotContainer);

    els.right.tableContainer.classList.add('table-container');
    els.right.container.appendChild(els.right.tableContainer);

    els.right.overlayContainer.classList.add('overlay-container');
    els.right.container.appendChild(els.right.overlayContainer);
    this.toggleRightPanelOverlay('ready');

    // Left container
    const headerContainer = document.createElement('div');
    headerContainer.classList.add('header');
    els.leftContainer.appendChild(headerContainer);

    const title = document.createElement('span');
    title.classList.add('title');
    title.textContent = this.options.dataSource.name;
    headerContainer.appendChild(title);

    els.statusContainer.classList.add('status');
    headerContainer.appendChild(els.statusContainer);

    // Search by trace id
    {
      const container = document.createElement('div');
      container.classList.add('search-widget', 'search-by-trace-id');
      els.leftContainer.appendChild(container);

      const title = document.createElement('div');
      title.classList.add('title');
      title.textContent = 'Search by Trace ID';
      container.appendChild(title);

      const { form, input, button } = this.elements.searchByTraceId;
      container.appendChild(form);

      input.required = true;
      input.placeholder = 'Trace ID';
      form.appendChild(input);

      button.textContent = 'Search';
      button.type = 'submit';
      form.appendChild(button);
    }

    // Normal search
    {
      const container = document.createElement('div');
      container.classList.add('search-widget', 'search');
      els.leftContainer.appendChild(container);

      const title = document.createElement('div');
      title.classList.add('title');
      title.textContent = 'Search';
      container.appendChild(title);

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
        button
      } = this.elements.search;
      container.appendChild(form);

      const serviceContainer = document.createElement('div');
      serviceContainer.classList.add('field');
      form.appendChild(serviceContainer);
      const serviceTitleContainer = document.createElement('div');
      serviceTitleContainer.textContent = 'Service';
      serviceTitleContainer.classList.add('field-title');
      serviceContainer.appendChild(serviceTitleContainer);
      serviceSelect.required = true;
      serviceContainer.appendChild(serviceSelect);

      const operationContainer = document.createElement('div');
      operationContainer.classList.add('field');
      form.appendChild(operationContainer);
      const operationTitleContainer = document.createElement('div');
      operationTitleContainer.textContent = 'Operation';
      operationTitleContainer.classList.add('field-title');
      operationContainer.appendChild(operationTitleContainer);
      operationSelect.required = true;
      operationContainer.appendChild(operationSelect);

      const tagsContainer = document.createElement('div');
      tagsContainer.classList.add('field');
      form.appendChild(tagsContainer);
      const tagsTitleContainer = document.createElement('div');
      tagsTitleContainer.textContent = 'Tags';
      tagsTitleContainer.classList.add('field-title');
      tagsContainer.appendChild(tagsTitleContainer);
      tagsInput.placeholder = 'http.status_code=200 error=true';
      tagsContainer.appendChild(tagsInput);

      const lookbackContainer = document.createElement('div');
      lookbackContainer.classList.add('field');
      form.appendChild(lookbackContainer);
      const lookbackTitleContainer = document.createElement('div');
      lookbackTitleContainer.textContent = 'Lookback';
      lookbackTitleContainer.classList.add('field-title');
      lookbackContainer.appendChild(lookbackTitleContainer);
      lookbackSelect.required = true;
      lookbackContainer.appendChild(lookbackSelect);

      lookbackSelect.innerHTML = `<option value="${JaegerLookbackValue.LAST_HOUR}">Last Hour</option>
      <option value="${JaegerLookbackValue.LAST_2_HOURS}">Last 2 Hours</option>
      <option value="${JaegerLookbackValue.LAST_3_HOURS}">Last 3 Hours</option>
      <option value="${JaegerLookbackValue.LAST_6_HOURS}">Last 6 Hours</option>
      <option value="${JaegerLookbackValue.LAST_12_HOURS}">Last 12 Hours</option>
      <option value="${JaegerLookbackValue.LAST_24_HOURS}">Last 24 Hours</option>
      <option value="${JaegerLookbackValue.LAST_2_DAYS}">Last 2 Days</option>
      <option value="${JaegerLookbackValue.LAST_7_DAYS}">Last 7 Days</option>
      <option value="${JaegerLookbackValue.CUSTOM}">Custom</option>`;

      lookbackContainer.appendChild(customLookbackInput);

      const minDurationContainer = document.createElement('div');
      minDurationContainer.classList.add('field');
      form.appendChild(minDurationContainer);
      const minDurationTitleContainer = document.createElement('div');
      minDurationTitleContainer.textContent = 'Min Duration';
      minDurationTitleContainer.classList.add('field-title');
      minDurationContainer.appendChild(minDurationTitleContainer);
      minDurationInput.placeholder = 'e.g. 1.2s, 100ms, 500us';
      minDurationContainer.appendChild(minDurationInput);

      const maxDurationContainer = document.createElement('div');
      maxDurationContainer.classList.add('field');
      form.appendChild(maxDurationContainer);
      const maxDurationTitleContainer = document.createElement('div');
      maxDurationTitleContainer.textContent = 'Max Duration';
      maxDurationTitleContainer.classList.add('field-title');
      maxDurationContainer.appendChild(maxDurationTitleContainer);
      maxDurationInput.placeholder = 'e.g. 1.2s, 100ms, 500us';
      maxDurationContainer.appendChild(maxDurationInput);

      const limitContainer = document.createElement('div');
      limitContainer.classList.add('field');
      form.appendChild(limitContainer);
      const limitTitleContainer = document.createElement('div');
      limitTitleContainer.textContent = 'Limit';
      limitTitleContainer.classList.add('field-title');
      limitContainer.appendChild(limitTitleContainer);
      limitInput.type = 'number';
      limitInput.min = '0';
      limitInput.value = '100';
      limitInput.required = true;
      limitContainer.appendChild(limitInput);

      button.textContent = 'Search';
      button.type = 'submit';
      form.appendChild(button);
    }

    // Bottom
    {
      const leftContainer = document.createElement('div');
      leftContainer.classList.add('left');
      els.bottom.container.appendChild(leftContainer);

      const rightContainer = document.createElement('div');
      rightContainer.classList.add('right');
      els.bottom.container.appendChild(rightContainer);

      els.bottom.selectionText.innerHTML = 'No trace selected';
      rightContainer.appendChild(els.bottom.selectionText);

      els.bottom.addToStageButton.textContent = 'Add to Stage';
      els.bottom.addToStageButton.disabled = true;
      rightContainer.appendChild(els.bottom.addToStageButton);
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
      SearchModalTracesTableViewEvent.SELECTIONS_UPDATED,
      this.binded.onTableSelectionUpdated
    );
    this.elements.searchByTraceId.form.addEventListener(
      'submit',
      this.binded.onSearchByTraceIdFormSubmit,
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
    this.elements.bottom.addToStageButton.addEventListener(
      'click',
      this.binded.onAddToStageButtonClick,
      false
    );
    window.addEventListener('resize', this.binded.onWindowResize, false);

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
          firstDayOfWeek: 1
        } as any
      }
    );
    // Initially hide custom date inputs
    this.onLookbackSelectChange();

    // Traces table
    // In order to get offsetWidth and height, the dom must be rendered
    // So before calling this `init()` method, ensure that dom is rendered.
    const { tableContainer } = this.elements.right;
    this.tracesTable.mount(tableContainer);
    this.tracesTable.init({
      width: tableContainer.offsetWidth,
      height: tableContainer.offsetHeight,
      showInStageColumn: true,
      indicateTracesOverlappingWithStage: true
    });

    // Traces scatter plot
    const { scatterPlotContainer } = this.elements.right;
    this.tracesScatterPlot.mount(scatterPlotContainer);
    this.tracesScatterPlot.init({
      width: scatterPlotContainer.offsetWidth,
      height: scatterPlotContainer.offsetHeight
    });
  }

  private initTippyInstances() {
    this.tippyInstaces = {
      status: tippy(this.elements.statusContainer, {
        delay: 0,
        duration: 0,
        updateDuration: 0,
        content: this.elements.statusContent,
        theme: 'tooltip',
        placement: 'top'
      })
    };
  }

  private async testApiAndUpdateStatus() {
    const els = this.elements;

    els.statusContainer.classList.remove('success', 'error');
    els.statusContainer.innerHTML = SvgCircleMedium;
    els.statusContent.textContent = 'Testing the API...';

    try {
      await this.api.test();

      els.statusContainer.classList.add('success');
      els.statusContainer.innerHTML = SvgCheckCircle;
      els.statusContent.textContent = 'API is OK';
    } catch (err) {
      els.statusContainer.classList.add('error');
      els.statusContainer.innerHTML = SvgAlertCircle;
      els.statusContent.textContent = err.message;
    }
  }

  onShow() {
    const { tableContainer, scatterPlotContainer } = this.elements.right;
    this.tracesScatterPlot.resize(
      scatterPlotContainer.offsetWidth,
      scatterPlotContainer.offsetHeight
    );
    this.tracesTable.resize(
      tableContainer.offsetWidth,
      tableContainer.offsetHeight
    );
    this.tracesTable.redrawTable(true);

    this.testApiAndUpdateStatus();
    this.updateServicesSelect();
  }

  private async updateServicesSelect() {
    const currentValue = this.elements.search.serviceSelect.value;

    try {
      const response = await this.api.getServices();

      if (!response.data) {
        new Noty({
          text: `There is no services found in Jaeger`,
          type: 'error'
        }).show();
        return;
      }

      const serviceNames: string[] = response.data.sort();
      this.elements.search.serviceSelect.innerHTML = serviceNames
        .map(s => `<option value="${s}">${s}</option>`)
        .join('');

      if (serviceNames.indexOf(currentValue) > -1) {
        this.elements.search.serviceSelect.value = currentValue;
      }

      this.updateOperationsSelect();
    } catch (err) {
      new Noty({
        text: `Could not fetch services from API: "${err.message}"`,
        type: 'error'
      }).show();
    }
  }

  private async updateOperationsSelect() {
    const serviceName = this.elements.search.serviceSelect.value;
    const currentValue = this.elements.search.operationSelect.value;

    try {
      const response = await this.api.getOperations(serviceName);
      const operationNames: string[] = ['all', ...response.data.sort()];
      this.elements.search.operationSelect.innerHTML = operationNames
        .map(o => `<option value="${o}">${o}</option>`)
        .join('');

      if (operationNames.indexOf(currentValue) > -1) {
        this.elements.search.operationSelect.value = currentValue;
      }
    } catch (err) {
      new Noty({
        text: `Could not fetch operations from API: "${err.message}"`,
        type: 'error'
      }).show();
    }
  }

  private onDataSourceManagerUpdate(ds: DataSource) {
    if (ds.id != this.options.dataSource.id) return;
    this.options.dataSource = ds;
    this.api = this.dsManager.apiFor(ds) as JaegerAPI;
  }

  private async onSearchByTraceIdFormSubmit(e: Event) {
    e.preventDefault();

    this.traceResults = [];
    this.elements.searchByTraceId.button.disabled = true;
    this.toggleRightPanelOverlay('loading');

    try {
      const formEl = this.elements.searchByTraceId;

      const traceSpans: Span[][] = await this.api.getTrace(formEl.input.value);
      this.traceResults = traceSpans.map(spans => new Trace(spans));
      this.tracesScatterPlot.setTraces(this.traceResults);
      this.tracesTable.updateTraces(this.traceResults);

      this.toggleRightPanelOverlay(
        this.traceResults.length == 0 ? 'no-results' : false
      );
    } catch (err) {
      this.toggleRightPanelOverlay('error', err.message);
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
      const query: JaegerAPISearchQuery = {
        service: formEl.serviceSelect.value
      };

      if (
        formEl.operationSelect.value &&
        formEl.operationSelect.value != 'all'
      ) {
        query.operation = formEl.operationSelect.value;
      }

      if (formEl.tagsInput.value) {
        query.tags = formEl.tagsInput.value;
      }

      if (formEl.lookbackSelect.value == JaegerLookbackValue.CUSTOM) {
        const dateRangeValue = this.customLookbackFlatpickr.input.value.trim();
        const parts = dateRangeValue.split(DATE_RANGE_SEPERATOR);
        if (parts.length != 2) {
          throw new Error(`Unsupported custom lookback`);
        }
        query.start = new Date(parts[0]).getTime() * 1000;
        query.end = new Date(parts[1]).getTime() * 1000;
      } else {
        const duration = parseDuration(formEl.lookbackSelect.value);
        query.end = Date.now() * 1000;
        query.start = query.end - duration * 1000;
      }

      if (formEl.minDurationInput.value) {
        query.minDuration = formEl.minDurationInput.value;
      }

      if (formEl.maxDurationInput.value) {
        query.maxDuration = formEl.maxDurationInput.value;
      }

      const limitIntValue = parseInt(formEl.limitInput.value, 10);
      if (isNaN(limitIntValue)) {
        throw new Error(`Unsupported limit value`);
      }
      query.limit = limitIntValue;

      const traceSpans: Span[][] = await this.api.search(query);
      this.traceResults = traceSpans.map(spans => new Trace(spans));
      this.tracesScatterPlot.setTraces(this.traceResults);
      this.tracesTable.updateTraces(this.traceResults);

      this.toggleRightPanelOverlay(
        this.traceResults.length == 0 ? 'no-results' : false
      );
    } catch (err) {
      this.toggleRightPanelOverlay('error', err.message);
    }

    this.elements.search.button.disabled = false;
  }

  private onServiceSelectChange() {
    this.updateOperationsSelect();
  }

  private onLookbackSelectChange() {
    if (
      this.elements.search.lookbackSelect.value == JaegerLookbackValue.CUSTOM
    ) {
      this.customLookbackFlatpickr.altInput.style.display = '';
      this.customLookbackFlatpickr.open();
    } else {
      this.customLookbackFlatpickr.altInput.style.display = 'none';
    }
  }

  private onWindowResize() {
    const { tableContainer, scatterPlotContainer } = this.elements.right;
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
    selectedTraces: SearchModalTraceRowData[]
  ) {
    // When we try to redraw tabulator while it's already redrawing,
    // it gives an error. So, we apply the most famous javascript workaround ever.
    // await new Promise(resolve => setTimeout(resolve, 0));
    this.selectedTraceIds = selectedTraces.map(t => t.id);

    if (selectedTraces.length == 0) {
      this.elements.bottom.addToStageButton.disabled = true;
      this.elements.bottom.selectionText.textContent = 'No trace selected';
      return;
    }

    let text = `${selectedTraces.length} traces`;
    if (selectedTraces.length == 1) {
      text = `1 trace`;
    }
    this.elements.bottom.selectionText.innerHTML = `<strong>${text}</strong> selected`;
    this.elements.bottom.addToStageButton.disabled = false;
  }

  private onAddToStageButtonClick() {
    const traces = this.selectedTraceIds.map(traceId => {
      return find(this.traceResults, t => t.id == traceId);
    });

    const modal = ModalManager.getSingleton().findModalFromElement(
      this.elements.container
    );
    if (!modal) throw new Error(`Could not find modal instance`);
    modal.close({ data: { action: 'addToStage', traces } });

    this.tracesTable.deselectAll();
  }

  private toggleRightPanelOverlay(
    type: 'ready' | 'loading' | 'no-results' | 'error' | false,
    errorMessage?: string
  ) {
    const { overlayContainer } = this.elements.right;

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
      SearchModalTracesTableViewEvent.SELECTIONS_UPDATED,
      this.binded.onTableSelectionUpdated
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
    this.elements.bottom.addToStageButton.removeEventListener(
      'click',
      this.binded.onAddToStageButtonClick,
      false
    );
    window.removeEventListener('resize', this.binded.onWindowResize, false);

    Object.values(this.tippyInstaces).forEach(t => t.destroy());
    this.tracesTable.dispose();
    this.customLookbackFlatpickr.destroy();
  }
}
