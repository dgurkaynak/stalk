import { Span } from '../../model/interfaces';
import { Trace } from '../../model/trace';
import { ModalManager } from '../ui/modal/modal-manager';
import Noty from 'noty';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import {
  SearchModalTracesTableView,
  SearchModalTracesTableViewEvent,
  SearchModalTraceRowData
} from '../search/search-modal-traces-table';
import parseDuration from 'parse-duration';
import throttle from 'lodash/throttle';
import find from 'lodash/find';
// import * as dgram from 'dgram';
// import * as http from 'http';
// import * as thrift from '../../vendor/thrift';
// import * as JaegerTypes from '../../vendor/jaeger/gen-nodejs/jaeger_types';

import SvgCircleMedium from '!!raw-loader!@mdi/svg/svg/circle-small.svg';
import SvgCheckCircle from '!!raw-loader!@mdi/svg/svg/check-circle.svg';
import SvgAlertCircle from '!!raw-loader!@mdi/svg/svg/alert-circle.svg';
import './live-collector-modal-content.css';

export class LiveCollectorModalContent {
  private tracesTable = new SearchModalTracesTableView();
  private traceResults: Trace[] = [];
  private selectedTraceIds: string[] = [];
  private elements = {
    container: document.createElement('div'),
    leftContainer: document.createElement('div'),
    rightContainer: document.createElement('div'),
    tracesTablePlaceholder: {
      container: document.createElement('div'),
      text: document.createElement('span')
    },
    bottom: {
      container: document.createElement('div'),
      closeButton: document.createElement('button'),
      selectionText: document.createElement('div'),
      addToStageButton: document.createElement('button')
    },
    jaegerAgent: {
      checkbox: document.createElement('input'),
      port: document.createElement('input')
    },
    jaegerCollector: {
      checkbox: document.createElement('input'),
      port: document.createElement('input'),
      urlAdress: document.createElement('span')
    },
    zipkinCollector: {
      checkbox: document.createElement('input'),
      port: document.createElement('input'),
      urlAdress: document.createElement('span')
    }
  };
  private tippyInstaces: {};
  inited = false;

  private binded = {
    onWindowResize: throttle(this.onWindowResize.bind(this), 100),
    onTableSelectionUpdated: this.onTableSelectionUpdated.bind(this),
    onCloseButtonClick: this.onCloseButtonClick.bind(this),
    onAddToStageButtonClick: this.onAddToStageButtonClick.bind(this)
  };

  constructor() {
    // Prepare DOM
    const els = this.elements;
    els.container.classList.add('live-collector-modal-content');

    const topContainer = document.createElement('div');
    topContainer.classList.add('top');
    els.container.appendChild(topContainer);

    els.bottom.container.classList.add('bottom');
    els.container.appendChild(els.bottom.container);

    els.leftContainer.classList.add('left');
    topContainer.appendChild(els.leftContainer);

    els.rightContainer.classList.add('right');
    topContainer.appendChild(els.rightContainer);

    // Left container
    const headerContainer = document.createElement('div');
    headerContainer.classList.add('header');
    els.leftContainer.appendChild(headerContainer);

    const title = document.createElement('span');
    title.classList.add('title');
    title.textContent = 'Live Collector';
    headerContainer.appendChild(title);

    // Jaeger agent
    {
      const container = document.createElement('div');
      container.classList.add('widget');
      els.leftContainer.appendChild(container);

      const title = document.createElement('div');
      title.classList.add('title');
      container.appendChild(title);

      const titleLeft = document.createElement('div');
      titleLeft.classList.add('left');
      titleLeft.textContent = 'Jaeger Agent';
      title.appendChild(titleLeft);

      const titleRight = document.createElement('div');
      titleRight.classList.add('switch-container');
      title.appendChild(titleRight);

      els.jaegerAgent.checkbox.type = 'checkbox';
      els.jaegerAgent.checkbox.classList.add('ios-switch');
      titleRight.appendChild(els.jaegerAgent.checkbox);

      const body = document.createElement('div');
      container.appendChild(body);

      const description = document.createElement('div');
      description.classList.add('description');
      body.appendChild(description);

      description.appendChild(document.createTextNode('Accepts '));

      const jaegerThriftSpan = document.createElement('span');
      jaegerThriftSpan.classList.add('code');
      jaegerThriftSpan.textContent = 'jaeger.thrift';
      description.appendChild(jaegerThriftSpan);

      description.appendChild(
        document.createTextNode(' in compact Thrift protocol over UDP.')
      );

      const portRow = document.createElement('div');
      portRow.classList.add('port-row');
      body.appendChild(portRow);

      const portLabel = document.createElement('div');
      portLabel.classList.add('label');
      portLabel.textContent = `Port:`;
      portRow.appendChild(portLabel);

      const portInputContainer = document.createElement('div');
      portRow.appendChild(portInputContainer);

      els.jaegerAgent.port.type = 'number';
      els.jaegerAgent.port.value = '6831';
      els.jaegerAgent.port.min = '1';
      els.jaegerAgent.port.max = '65535';
      portInputContainer.appendChild(els.jaegerAgent.port);
    }

    // Jaeger collector
    {
      const container = document.createElement('div');
      container.classList.add('widget');
      els.leftContainer.appendChild(container);

      const title = document.createElement('div');
      title.classList.add('title');
      container.appendChild(title);

      const titleLeft = document.createElement('div');
      titleLeft.classList.add('left');
      titleLeft.textContent = 'Jaeger Collector';
      title.appendChild(titleLeft);

      const titleRight = document.createElement('div');
      titleRight.classList.add('switch-container');
      title.appendChild(titleRight);

      els.jaegerCollector.checkbox.type = 'checkbox';
      els.jaegerCollector.checkbox.classList.add('ios-switch');
      titleRight.appendChild(els.jaegerCollector.checkbox);

      const body = document.createElement('div');
      container.appendChild(body);

      const description = document.createElement('div');
      description.classList.add('description');
      body.appendChild(description);

      description.appendChild(document.createTextNode('Accepts '));

      const jaegerThriftSpan = document.createElement('span');
      jaegerThriftSpan.classList.add('code');
      jaegerThriftSpan.textContent = 'jaeger.thrift';
      description.appendChild(jaegerThriftSpan);

      description.appendChild(
        document.createTextNode(
          ' in binary Thrift protocol over HTTP. Clients can make a POST request to '
        )
      );

      els.jaegerCollector.urlAdress.classList.add('code');
      els.jaegerCollector.urlAdress.textContent =
        'http://localhost:14268/api/traces';
      description.appendChild(els.jaegerCollector.urlAdress);

      description.appendChild(document.createTextNode(' url to send spans.'));

      const portRow = document.createElement('div');
      portRow.classList.add('port-row');
      body.appendChild(portRow);

      const portLabel = document.createElement('div');
      portLabel.classList.add('label');
      portLabel.textContent = `Port:`;
      portRow.appendChild(portLabel);

      const portInputContainer = document.createElement('div');
      portRow.appendChild(portInputContainer);

      els.jaegerCollector.port.type = 'number';
      els.jaegerCollector.port.value = '14268';
      els.jaegerCollector.port.min = '1';
      els.jaegerCollector.port.max = '65535';
      portInputContainer.appendChild(els.jaegerCollector.port);
    }

    // Zipkin collector
    {
      const container = document.createElement('div');
      container.classList.add('widget');
      els.leftContainer.appendChild(container);

      const title = document.createElement('div');
      title.classList.add('title');
      container.appendChild(title);

      const titleLeft = document.createElement('div');
      titleLeft.classList.add('left');
      titleLeft.textContent = 'Zipkin Collector';
      title.appendChild(titleLeft);

      const titleRight = document.createElement('div');
      titleRight.classList.add('switch-container');
      title.appendChild(titleRight);

      els.zipkinCollector.checkbox.type = 'checkbox';
      els.zipkinCollector.checkbox.classList.add('ios-switch');
      titleRight.appendChild(els.zipkinCollector.checkbox);

      const body = document.createElement('div');
      container.appendChild(body);

      const description = document.createElement('div');
      description.classList.add('description');
      body.appendChild(description);

      description.appendChild(
        document.createTextNode(
          'Accepts spans in JSON format over HTTP. Clients can make a POST request to '
        )
      );

      els.zipkinCollector.urlAdress.classList.add('code');
      els.zipkinCollector.urlAdress.textContent =
        'http://localhost:9411/api/v2/spans';
      description.appendChild(els.zipkinCollector.urlAdress);

      description.appendChild(document.createTextNode(' url to send spans.'));

      const portRow = document.createElement('div');
      portRow.classList.add('port-row');
      body.appendChild(portRow);

      const portLabel = document.createElement('div');
      portLabel.classList.add('label');
      portLabel.textContent = `Port:`;
      portRow.appendChild(portLabel);

      const portInputContainer = document.createElement('div');
      portRow.appendChild(portInputContainer);

      els.zipkinCollector.port.type = 'number';
      els.zipkinCollector.port.value = '9411';
      els.zipkinCollector.port.min = '1';
      els.zipkinCollector.port.max = '65535';
      portInputContainer.appendChild(els.zipkinCollector.port);
    }

    // Table placeholder
    const elsTP = els.tracesTablePlaceholder;
    elsTP.container.classList.add('tabulator-placeholder');
    elsTP.text.textContent = 'No traces collected';
    elsTP.container.appendChild(elsTP.text);

    // Bottom
    {
      const leftContainer = document.createElement('div');
      leftContainer.classList.add('left');
      els.bottom.container.appendChild(leftContainer);

      const rightContainer = document.createElement('div');
      rightContainer.classList.add('right');
      els.bottom.container.appendChild(rightContainer);

      els.bottom.closeButton.textContent = 'Close';
      leftContainer.appendChild(els.bottom.closeButton);

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
    this.tracesTable.on(
      SearchModalTracesTableViewEvent.SELECTIONS_UPDATED,
      this.binded.onTableSelectionUpdated
    );
    this.elements.bottom.closeButton.addEventListener(
      'click',
      this.binded.onCloseButtonClick,
      false
    );
    this.elements.bottom.addToStageButton.addEventListener(
      'click',
      this.binded.onAddToStageButtonClick,
      false
    );
    window.addEventListener('resize', this.binded.onWindowResize, false);

    // Traces table
    // In order to get offsetWidth and height, the dom must be rendered
    // So before calling this `init()` method, ensure that dom is rendered.
    this.tracesTable.mount(this.elements.rightContainer);
    const { offsetWidth: w, offsetHeight: h } = this.elements.rightContainer;
    this.tracesTable.init({
      width: w,
      height: h,
      indicateTracesAlreadyInTheStage: true,
      indicateTracesOverlappingWithStage: true,
      placeholderElement: this.elements.tracesTablePlaceholder.container
    });

    this.inited = true;
  }

  private initTippyInstances() {
    // TODO: Maybe ?!
    this.tippyInstaces = {};
  }

  onShow() {
    const { offsetWidth: w, offsetHeight: h } = this.elements.rightContainer;
    this.tracesTable.resize(w, h);

    // TODO

    this.tracesTable.redrawTable(true);
  }

  private onWindowResize() {
    const { offsetWidth: w, offsetHeight: h } = this.elements.rightContainer;
    this.tracesTable.resize(w, h);
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

  private onCloseButtonClick() {
    const modal = ModalManager.getSingleton().findModalFromElement(
      this.elements.container
    );
    if (!modal) throw new Error(`Could not find modal instance`);
    modal.close();
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

  getElement() {
    return this.elements.container;
  }

  dispose() {
    this.tracesTable.removeListener(
      SearchModalTracesTableViewEvent.SELECTIONS_UPDATED,
      this.binded.onTableSelectionUpdated
    );
    this.elements.bottom.closeButton.removeEventListener(
      'click',
      this.binded.onCloseButtonClick,
      false
    );
    this.elements.bottom.addToStageButton.removeEventListener(
      'click',
      this.binded.onAddToStageButtonClick,
      false
    );
    window.removeEventListener('resize', this.binded.onWindowResize, false);

    // Object.values(this.tippyInstaces).forEach(t => t.destroy());
    this.tracesTable.dispose();
  }
}
