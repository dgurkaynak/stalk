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
import groupBy from 'lodash/groupBy';
import {
  JaegerAgentUDPServer,
  JaegerAgentUDPServerState
} from './jaeger-agent-udp-server';
import {
  JaegerCollectorHTTPServer,
  JaegerCollectorHTTPServerState
} from './jaeger-collector-http-server';

import SvgCircleMedium from '!!raw-loader!@mdi/svg/svg/circle-small.svg';
import SvgCheckCircle from '!!raw-loader!@mdi/svg/svg/check-circle.svg';
import SvgAlertCircle from '!!raw-loader!@mdi/svg/svg/alert-circle.svg';
import './live-collector-modal-content.css';

export class LiveCollectorModalContent {
  private tracesTable = new SearchModalTracesTableView();
  private spansDB: Span[] = [];
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

  private jaegerAgentUDPServer = new JaegerAgentUDPServer();
  private jaegerCollectorHTTPServer = new JaegerCollectorHTTPServer();

  private binded = {
    onWindowResize: throttle(this.onWindowResize.bind(this), 100),
    onTableSelectionUpdated: this.onTableSelectionUpdated.bind(this),
    onCloseButtonClick: this.onCloseButtonClick.bind(this),
    onAddToStageButtonClick: this.onAddToStageButtonClick.bind(this),
    updateTraces: throttle(this.updateTraces.bind(this), 5000),
    onJaegerAgentServerStateChange: this.onJaegerAgentServerStateChange.bind(
      this
    ),
    onJaegerAgentServerSpansRecieve: this.onJaegerAgentServerSpansRecieve.bind(
      this
    ),
    onJaegerAgentPortInput: this.onJaegerAgentPortInput.bind(this),
    onJaegerAgentCheckboxChanged: this.onJaegerAgentCheckboxChanged.bind(this),
    onJaegerCollectorServerStateChange: this.onJaegerCollectorServerStateChange.bind(
      this
    ),
    onJaegerCollectorServerSpansRecieve: this.onJaegerCollectorServerSpansRecieve.bind(
      this
    ),
    onJaegerCollectorPortInput: this.onJaegerCollectorPortInput.bind(this),
    onJaegerCollectorCheckboxChanged: this.onJaegerCollectorCheckboxChanged.bind(
      this
    )
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
      els.jaegerAgent.port.addEventListener(
        'input',
        this.binded.onJaegerAgentPortInput,
        false
      );
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
      els.jaegerCollector.port.addEventListener(
        'input',
        this.binded.onJaegerCollectorPortInput,
        false
      );
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

    // Bind live collector server events
    this.jaegerAgentUDPServer.onStateChange = this.binded.onJaegerAgentServerStateChange;
    this.jaegerAgentUDPServer.onSpansRecieve = this.binded.onJaegerAgentServerSpansRecieve;
    this.jaegerCollectorHTTPServer.onStateChange = this.binded.onJaegerCollectorServerStateChange;
    this.jaegerCollectorHTTPServer.onSpansRecieve = this.binded.onJaegerCollectorServerSpansRecieve;
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
    this.elements.jaegerAgent.checkbox.addEventListener(
      'change',
      this.binded.onJaegerAgentCheckboxChanged,
      false
    );
    this.elements.jaegerCollector.checkbox.addEventListener(
      'change',
      this.binded.onJaegerCollectorCheckboxChanged,
      false
    );

    // Traces table
    // In order to get offsetWidth and height, the dom must be rendered
    // So before calling this `init()` method, ensure that dom is rendered.
    this.tracesTable.mount(this.elements.rightContainer);
    const { offsetWidth: w, offsetHeight: h } = this.elements.rightContainer;
    this.tracesTable.init({
      width: w,
      height: h,
      showInStageColumn: true,
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
    const traces: Trace[] = [];

    this.selectedTraceIds.forEach(traceId => {
      const traceSpans = this.spansDB.filter(span => {
        return span.traceId == traceId;
      });
      const trace = new Trace(traceSpans);
      traces.push(trace);
    });

    const modal = ModalManager.getSingleton().findModalFromElement(
      this.elements.container
    );
    if (!modal) throw new Error(`Could not find modal instance`);
    modal.close({ data: { action: 'addToStage', traces } });

    this.tracesTable.deselectAll();
  }

  private updateTraces() {
    const tracesObj = groupBy(this.spansDB, span => span.traceId);
    const traces: Trace[] = [];
    for (const traceId in tracesObj) {
      const spans = tracesObj[traceId];
      const trace = new Trace(spans);
      traces.push(trace);
    }

    this.tracesTable.updateTraces(traces);
  }

  private onJaegerAgentPortInput() {
    const port = parseInt(this.elements.jaegerAgent.port.value, 10);
    if (isNaN(port)) {
      this.elements.jaegerAgent.port.value =
        this.jaegerAgentUDPServer.getPort() + '';
      return;
    }

    const isChanged = this.jaegerAgentUDPServer.setPort(port);
    if (!isChanged) {
      this.elements.jaegerAgent.port.value =
        this.jaegerAgentUDPServer.getPort() + '';
      return;
    }
  }

  private onJaegerAgentServerStateChange(state: JaegerAgentUDPServerState) {
    this.elements.jaegerAgent.port.disabled =
      state != JaegerAgentUDPServerState.STOPPED;
    this.elements.jaegerAgent.checkbox.checked =
      state != JaegerAgentUDPServerState.STOPPED;
  }

  private async onJaegerAgentCheckboxChanged() {
    if (this.elements.jaegerAgent.checkbox.checked) {
      /**
       * Start the server
       */
      try {
        await this.jaegerAgentUDPServer.start();
      } catch (err) {
        new Noty({
          text: `Jaeger Agent UDP Server could not started: "${err.message}"`,
          type: 'error'
        }).show();
      }
    } else {
      /**
       * Stop the server
       */
      try {
        await this.jaegerAgentUDPServer.stop();
      } catch (err) {
        new Noty({
          text: `Jaeger Agent UDP Server could not stopped: "${err.message}"`,
          type: 'error'
        }).show();
      }
    }
  }

  private onJaegerAgentServerSpansRecieve(spans: Span[]) {
    this.spansDB.push(...spans);
    this.binded.updateTraces();
  }

  private onJaegerCollectorPortInput() {
    const port = parseInt(this.elements.jaegerCollector.port.value, 10);
    if (isNaN(port)) {
      this.elements.jaegerCollector.port.value =
        this.jaegerCollectorHTTPServer.getPort() + '';
      return;
    }

    const isChanged = this.jaegerCollectorHTTPServer.setPort(port);
    if (!isChanged) {
      this.elements.jaegerCollector.port.value =
        this.jaegerCollectorHTTPServer.getPort() + '';
      return;
    }
  }

  private onJaegerCollectorServerStateChange(
    state: JaegerCollectorHTTPServerState
  ) {
    this.elements.jaegerCollector.port.disabled =
      state != JaegerCollectorHTTPServerState.STOPPED;
    this.elements.jaegerCollector.checkbox.checked =
      state != JaegerCollectorHTTPServerState.STOPPED;
  }

  private async onJaegerCollectorCheckboxChanged() {
    if (this.elements.jaegerCollector.checkbox.checked) {
      /**
       * Start the server
       */
      try {
        await this.jaegerCollectorHTTPServer.start();
      } catch (err) {
        new Noty({
          text: `Jaeger Collector HTTP Server could not started: "${err.message}"`,
          type: 'error'
        }).show();
      }
    } else {
      /**
       * Stop the server
       */
      try {
        await this.jaegerCollectorHTTPServer.stop();
      } catch (err) {
        new Noty({
          text: `Jaeger Collector HTTP Server could not stopped: "${err.message}"`,
          type: 'error'
        }).show();
      }
    }
  }

  private onJaegerCollectorServerSpansRecieve(spans: Span[]) {
    this.spansDB.push(...spans);
    this.binded.updateTraces();
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
    this.elements.jaegerAgent.checkbox.removeEventListener(
      'change',
      this.binded.onJaegerAgentCheckboxChanged,
      false
    );
    this.elements.jaegerAgent.port.removeEventListener(
      'input',
      this.binded.onJaegerAgentPortInput,
      false
    );
    this.elements.jaegerCollector.checkbox.removeEventListener(
      'change',
      this.binded.onJaegerCollectorCheckboxChanged,
      false
    );
    this.elements.jaegerCollector.port.removeEventListener(
      'input',
      this.binded.onJaegerCollectorPortInput,
      false
    );

    // Object.values(this.tippyInstaces).forEach(t => t.destroy());
    this.tracesTable.dispose();
  }
}
