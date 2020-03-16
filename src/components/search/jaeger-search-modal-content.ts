import { DataSourceType, DataSource } from '../../model/datasource/interfaces';
import { ModalManager } from '../ui/modal/modal-manager';
import Noty from 'noty';
import { JaegerAPI } from '../../model/jaeger';
import tippy, { Instance as TippyInstance } from 'tippy.js';

import SvgCircleMedium from '!!raw-loader!@mdi/svg/svg/circle-small.svg';
import SvgCheckCircle from '!!raw-loader!@mdi/svg/svg/check-circle.svg';
import SvgAlertCircle from '!!raw-loader!@mdi/svg/svg/alert-circle.svg';
import './jaeger-search-modal-content.css';

export interface JaegerSearchModalContentOptions {
  dataSource: DataSource;
  api: JaegerAPI;
}

export enum JaegerLookbackValue {
  LAST_HOUR = 'lastHour',
  LAST_2_HOURS = 'last2Hours',
  LAST_3_HOURS = 'last3Hours',
  LAST_6_HOURS = 'last6Hours',
  LAST_12_HOURS = 'last12Hours',
  LAST_24_HOURS = 'last24Hours',
  LAST_2_DAYS = 'last2Days',
  LAST_7_DAYS = 'last7Days'
}

export class JaegerSearchModalContent {
  private elements = {
    container: document.createElement('div'),
    statusContainer: document.createElement('span'),
    statusContent: document.createElement('div'),
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
    onSearchByTraceIdFormSubmit: this.onSearchByTraceIdFormSubmit.bind(this),
    onSearcFormSubmit: this.onSearcFormSubmit.bind(this)
  };

  constructor(private options: JaegerSearchModalContentOptions) {
    // Prepare DOM
    const els = this.elements;
    els.container.classList.add('jaeger-search-modal-content');

    const leftContainer = document.createElement('div');
    leftContainer.classList.add('left');
    els.container.appendChild(leftContainer);

    const rightContainer = document.createElement('div');
    rightContainer.classList.add('right');
    els.container.appendChild(rightContainer);

    // Left container
    const headerContainer = document.createElement('div');
    headerContainer.classList.add('header');
    leftContainer.appendChild(headerContainer);

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
      leftContainer.appendChild(container);

      const title = document.createElement('div');
      title.classList.add('title');
      title.textContent = 'Search by Trace ID';
      container.appendChild(title);

      const { form, input, button } = this.elements.searchByTraceId;
      container.appendChild(form);

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
      leftContainer.appendChild(container);

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
      serviceContainer.appendChild(serviceSelect);

      const operationContainer = document.createElement('div');
      operationContainer.classList.add('field');
      form.appendChild(operationContainer);
      const operationTitleContainer = document.createElement('div');
      operationTitleContainer.textContent = 'Operation';
      operationTitleContainer.classList.add('field-title');
      operationContainer.appendChild(operationTitleContainer);
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
      lookbackContainer.appendChild(lookbackSelect);

      lookbackSelect.innerHTML = `<option value="${JaegerLookbackValue.LAST_HOUR}">Last Hour</option>
      <option value="${JaegerLookbackValue.LAST_2_HOURS}">Last 2 Hours</option>
      <option value="${JaegerLookbackValue.LAST_3_HOURS}">Last 3 Hours</option>
      <option value="${JaegerLookbackValue.LAST_6_HOURS}">Last 6 Hours</option>
      <option value="${JaegerLookbackValue.LAST_12_HOURS}">Last 12 Hours</option>
      <option value="${JaegerLookbackValue.LAST_24_HOURS}">Last 24 Hours</option>
      <option value="${JaegerLookbackValue.LAST_2_DAYS}">Last 2 Days</option>
      <option value="${JaegerLookbackValue.LAST_7_DAYS}">Last 7 Days</option>`;

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
      limitInput.value = '20';
      limitInput.type = 'number';
      limitContainer.appendChild(limitInput);

      button.textContent = 'Search';
      button.type = 'submit';
      form.appendChild(button);
    }

    // Right container
  }

  init() {
    this.initTippyInstances();

    // TODO: Listen for data source updates!

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

  async testApiAndUpdateStatus() {
    const els = this.elements;

    els.statusContainer.classList.remove('success', 'error');
    els.statusContainer.innerHTML = SvgCircleMedium;
    els.statusContent.textContent = 'Testing the API...';

    try {
      await this.options.api.test();

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
    this.testApiAndUpdateStatus();
    console.log('on show kanki');
  }

  private onSearchByTraceIdFormSubmit(e: Event) {
    e.preventDefault();
    console.log('search by trace id form submit');
  }

  private onSearcFormSubmit(e: Event) {
    e.preventDefault();
    console.log('search form submit');
  }

  getElement() {
    return this.elements.container;
  }

  dispose() {
    Object.values(this.tippyInstaces).forEach(t => t.destroy());

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
  }
}
