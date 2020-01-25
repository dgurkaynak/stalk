import { AppToolbar } from './components/app-toolbar/app-toolbar';
import throttle from 'lodash/throttle';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import { DataSourceManager } from './model/datasource/manager';
import { SpanGroupingManager } from './model/span-grouping/manager';
import { SpanColoringManager } from './model/span-coloring-manager';
import { SpanLabellingManager } from './model/span-labelling-manager';
import { Trace } from './model/trace';
import { Stage, StageEvent } from './model/stage';
import { TimelineWrapper } from './components/timeline-wrapper/timeline-wrapper';
import { DockPanel } from '@phosphor/widgets';
import { WidgetWrapper } from './components/ui/widget-wrapper';
import { LogsDataView } from './components/logs-data-view/logs-data-view';
import { SpansDataView } from './components/spans-data-view/spans-data-view';
import Noty from 'noty';
import { isJaegerJSON, convertFromJaegerTrace } from './model/api/jaeger/span';
import { isZipkinJSON, convertFromZipkinTrace } from './model/api/zipkin/span';
import { TypeScriptManager } from './components/customization/typescript-manager';
import { ipcRenderer } from 'electron';
import { SpanSummaryView } from './components/span-summary/span-summary';
import { SpanTagsView } from './components/span-tags/span-tags';
import { SpanLogsView } from './components/span-logs/span-logs';
import { SpansTableView } from './components/spans-table/spans-table';
import { LogsTableView } from './components/logs-table/logs-table';
import {
  ContextMenuManager,
  ContextMenuEvent
} from './components/ui/context-menu/context-menu-manager';

import 'tippy.js/dist/tippy.css';
import 'noty/lib/noty.css';
import 'noty/lib/themes/bootstrap-v4.css';
import './app.css';

export enum AppWidgetType {
  TIMELINE_VIEW = 'timeline-view',
  LOGS_DATA_VIEW = 'logs-data-view',
  SPANS_DATA_VIEW = 'spans-data-view',
  SPAN_SUMMARY = 'span-summary',
  SPAN_TAGS = 'span-tags',
  SPAN_LOGS = 'span-logs',
  SPANS_TABLE = 'spans-table',
  LOGS_TABLE = 'logs-table'
}

export interface AppOptions {
  element: HTMLDivElement;
}

export class App {
  private stage = Stage.getSingleton();
  private contextMenuManager = ContextMenuManager.getSingleton();
  private toolbar = new AppToolbar({});
  private timeline = new TimelineWrapper();
  private logsData = new LogsDataView();
  private spansData = new SpansDataView();
  private spanSummary = new SpanSummaryView();
  private spanTags = new SpanTagsView();
  private spanLogs = new SpanLogsView();
  private spansTable = new SpansTableView();
  private logsTable = new LogsTableView();

  private dockPanel = new DockPanel();
  private widgets: { [key: string]: WidgetWrapper } = {};
  private dropZoneEl = document.createElement('div');

  private binded = {
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    onWindowResize: this.onWindowResize.bind(this),
    onTimelineResize: this.onTimelineResize.bind(this),
    onLogsDataResize: throttle(this.onLogsDataResize.bind(this), 100),
    onSpansDataResize: throttle(this.onSpansDataResize.bind(this), 100),
    onSpanSummaryResize: throttle(this.onSpanSummaryResize.bind(this), 100),
    onSpanTagsResize: throttle(this.onSpanTagsResize.bind(this), 100),
    onSpanLogsResize: throttle(this.onSpanLogsResize.bind(this), 100),
    onSpansTableResize: throttle(this.onSpansTableResize.bind(this), 100),
    onSpansTableShow: this.onSpansTableShow.bind(this),
    onLogsTableResize: throttle(this.onLogsTableResize.bind(this), 100),
    onLogsTableShow: this.onLogsTableShow.bind(this),
    onDrop: this.onDrop.bind(this),
    onDragOver: this.onDragOver.bind(this),
    onDragLeave: this.onDragLeave.bind(this),
    showSpanInTableView: this.showSpanInTableView.bind(this),
    showSpanInTimelineView: this.showSpanInTimelineView.bind(this)
  };

  constructor(private options: AppOptions) {
    // Noop
  }

  async init() {
    // Init managers related with db
    await Promise.all([
      DataSourceManager.getSingleton().init(),
      SpanGroupingManager.getSingleton().init(),
      SpanColoringManager.getSingleton().init(),
      SpanLabellingManager.getSingleton().init(),
      TypeScriptManager.getSingleton().init(),
      this.contextMenuManager.init()
    ]);

    this.initDockPanelAndWidgets();

    this.toolbar.mount(this.options.element);

    const timelineWidgetEl = this.widgets[AppWidgetType.TIMELINE_VIEW].node;
    this.timeline.mount(timelineWidgetEl);
    const { offsetWidth: w1, offsetHeight: h1 } = timelineWidgetEl;
    this.timeline.init({ width: w1, height: h1 });
    this.toolbar.init(); // Needs dsManager

    const spansTableWidgetEl = this.widgets[AppWidgetType.SPANS_TABLE].node;
    this.spansTable.mount(spansTableWidgetEl);
    const { offsetWidth: w4, offsetHeight: h4 } = spansTableWidgetEl;
    this.spansTable.init({ width: w4, height: h4 });

    const logsTableWidgetEl = this.widgets[AppWidgetType.LOGS_TABLE].node;
    this.logsTable.mount(logsTableWidgetEl);
    const { offsetWidth: w5, offsetHeight: h5 } = logsTableWidgetEl;
    this.logsTable.init({ width: w5, height: h5 });

    const logsDataWidgetEl = this.widgets[AppWidgetType.LOGS_DATA_VIEW].node;
    this.logsData.mount(logsDataWidgetEl);
    const { offsetWidth: w2, offsetHeight: h2 } = logsDataWidgetEl;
    this.logsData.init({ width: w2, height: h2 });

    const spansDataWidgetEl = this.widgets[AppWidgetType.SPANS_DATA_VIEW].node;
    this.spansData.mount(spansDataWidgetEl);
    const { offsetWidth: w3, offsetHeight: h3 } = spansDataWidgetEl;
    this.spansData.init({ width: w3, height: h3 });

    const spanSummaryWidgetEl = this.widgets[AppWidgetType.SPAN_SUMMARY].node;
    this.spanSummary.mount(spanSummaryWidgetEl);
    this.spanSummary.init({
      timeline: this.timeline.timeline,
      spansTable: this.spansTable
    });

    const spanTagsWidgetEl = this.widgets[AppWidgetType.SPAN_TAGS].node;
    this.spanTags.mount(spanTagsWidgetEl);
    this.spanTags.init({
      timeline: this.timeline.timeline,
      spansTable: this.spansTable
    });

    const spanLogsWidgetEl = this.widgets[AppWidgetType.SPAN_LOGS].node;
    this.spanLogs.mount(spanLogsWidgetEl);
    this.spanLogs.init({
      timeline: this.timeline.timeline,
      spansTable: this.spansTable
    });

    this.initDropZone();

    // Bind events
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    window.addEventListener('resize', this.binded.onWindowResize, false);
    this.options.element.addEventListener('drop', this.binded.onDrop, false);
    this.options.element.addEventListener(
      'dragover',
      this.binded.onDragOver,
      false
    );
    this.dropZoneEl.addEventListener(
      'dragleave',
      this.binded.onDragLeave,
      false
    );
    this.contextMenuManager.on(
      ContextMenuEvent.SHOW_SPAN_IN_TABLE_VIEW,
      this.binded.showSpanInTableView
    );
    this.contextMenuManager.on(
      ContextMenuEvent.SHOW_SPAN_IN_TIMELINE_VIEW,
      this.binded.showSpanInTimelineView
    );

    // Hide initial loading
    const loadingEl = document.getElementById(
      'initial-loading'
    ) as HTMLDivElement;
    if (loadingEl) {
      loadingEl.addEventListener(
        'transitionend',
        () => {
          document.body.removeChild(loadingEl);
        },
        { once: true }
      );
      loadingEl.classList.add('hidden');
    }

    // Handle `open-file` events
    ipcRenderer.on('open-file', (event, arg) => {
      this.openFiles([arg]);
    });
    ipcRenderer.once('app-initalized-response', (event, arg) => {
      this.openFiles(arg.openFiles);
    });
    ipcRenderer.send('app-initalized');
  }

  initDockPanelAndWidgets() {
    this.dockPanel.id = 'app-dock-panel';

    this.widgets[AppWidgetType.TIMELINE_VIEW] = new WidgetWrapper({
      title: 'Timeline View',
      onResize: this.binded.onTimelineResize
    });

    this.widgets[AppWidgetType.LOGS_DATA_VIEW] = new WidgetWrapper({
      title: 'Logs Data View',
      onResize: this.binded.onLogsDataResize
    });

    this.widgets[AppWidgetType.SPANS_DATA_VIEW] = new WidgetWrapper({
      title: 'Spans Data View',
      onResize: this.binded.onSpansDataResize
    });

    this.widgets[AppWidgetType.SPANS_TABLE] = new WidgetWrapper({
      title: 'Spans Table View',
      onResize: this.binded.onSpansTableResize,
      onAfterShow: this.binded.onSpansTableShow
    });

    this.widgets[AppWidgetType.LOGS_TABLE] = new WidgetWrapper({
      title: 'Logs Table View',
      onResize: this.binded.onLogsTableResize,
      onAfterShow: this.binded.onLogsTableShow
    });

    this.widgets[AppWidgetType.SPAN_SUMMARY] = new WidgetWrapper({
      title: 'Span Summary',
      onResize: this.binded.onSpanSummaryResize
    });

    this.widgets[AppWidgetType.SPAN_TAGS] = new WidgetWrapper({
      title: 'Span Tags',
      onResize: this.binded.onSpanTagsResize
    });

    this.widgets[AppWidgetType.SPAN_LOGS] = new WidgetWrapper({
      title: 'Span Logs',
      onResize: this.binded.onSpanLogsResize
    });

    this.dockPanel.restoreLayout({
      main: {
        children: [
          {
            type: 'tab-area',
            currentIndex: 0,
            widgets: [
              this.widgets[AppWidgetType.TIMELINE_VIEW],
              this.widgets[AppWidgetType.SPANS_DATA_VIEW],
              this.widgets[AppWidgetType.LOGS_DATA_VIEW],
              this.widgets[AppWidgetType.SPANS_TABLE],
              this.widgets[AppWidgetType.LOGS_TABLE]
            ]
          },
          {
            type: 'split-area',
            orientation: 'horizontal',
            sizes: [0.33, 0.33, 0.33],
            children: [
              {
                type: 'tab-area',
                currentIndex: 0,
                widgets: [this.widgets[AppWidgetType.SPAN_SUMMARY]]
              },
              {
                type: 'tab-area',
                currentIndex: 0,
                widgets: [this.widgets[AppWidgetType.SPAN_TAGS]]
              },
              {
                type: 'tab-area',
                currentIndex: 0,
                widgets: [this.widgets[AppWidgetType.SPAN_LOGS]]
              }
            ]
          }
        ],
        orientation: 'vertical',
        sizes: [0.7, 0.3],
        type: 'split-area'
      }
    });

    DockPanel.attach(this.dockPanel, this.options.element);
  }

  onStageTraceAdded(trace: Trace) {
    this.timeline.addTrace(trace);
  }

  onStageTraceRemoved(trace: Trace) {
    this.timeline.removeTrace(trace);
  }

  onWindowResize() {
    this.dockPanel.update();
  }

  onTimelineResize(msg: { width: number; height: number }) {
    this.timeline.resize(msg.width, msg.height);
  }

  onLogsDataResize(msg: { width: number; height: number }) {
    this.logsData.resize(msg.width, msg.height);
  }

  onSpansDataResize(msg: { width: number; height: number }) {
    this.spansData.resize(msg.width, msg.height);
  }

  onSpanSummaryResize(msg: { width: number; height: number }) {
    this.spanSummary.resize(msg.width, msg.height);
  }

  onSpanTagsResize(msg: { width: number; height: number }) {
    this.spanTags.resize(msg.width, msg.height);
  }

  onSpanLogsResize(msg: { width: number; height: number }) {
    this.spanLogs.resize(msg.width, msg.height);
  }

  onSpansTableResize(msg: { width: number; height: number }) {
    this.spansTable.resize(msg.width, msg.height);
  }

  onSpansTableShow() {
    this.spansTable.redrawTable();
  }

  onLogsTableResize(msg: { width: number; height: number }) {
    this.logsTable.resize(msg.width, msg.height);
  }

  onLogsTableShow() {
    this.logsTable.redrawTable();
  }

  initDropZone() {
    this.dropZoneEl.id = 'drop-zone';
    // Drop zone should not have any children, it causes unexpected dragleave/dragover events
    // https://stackoverflow.com/questions/20958176/why-is-dragleave-event-firing-unexpectedly
    // That's why we seperate border and overlay text
    this.dropZoneEl.innerHTML = `<div class="border"></div>
      <div class="overlay-text">Drop Jaeger or Zipkin trace(s) here</div>`;
    this.options.element.appendChild(this.dropZoneEl);
  }

  async onDrop(e: DragEvent) {
    e.preventDefault();
    this.dropZoneEl.style.display = 'none';
    const errorMessages = [] as string[];

    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      // If dropped items aren't files, reject them
      const item = e.dataTransfer.items[i];

      if (item.kind != 'file') {
        errorMessages.push('Only files can be dropped');
        continue;
      }

      const file = item.getAsFile();
      if (file.type != 'application/json') {
        errorMessages.push(`${file.name}: Not a JSON file`);
        continue;
      }

      let fileContent = '';
      try {
        fileContent = await readFile(file);
      } catch (err) {
        errorMessages.push(
          `${file.name}: Could not read its content -- ${err.message}`
        );
        continue;
      }

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(fileContent);
      } catch (err) {
        errorMessages.push(`${file.name}: Invalid JSON`);
        continue;
      }

      const isJaeger = isJaegerJSON(parsedJson);
      const isZipkin = isZipkinJSON(parsedJson);

      if (!isJaeger && !isZipkin) {
        errorMessages.push(`${file.name}: Unrecognized Jaeger/Zipkin JSON`);
        continue;
      }

      if (isJaeger) {
        parsedJson.data.forEach((rawTrace: any) => {
          const spans = convertFromJaegerTrace(rawTrace);
          const trace = new Trace(spans);
          this.stage.addTrace(trace);
        });
      }

      if (isZipkin) {
        if (isArray(parsedJson[0])) {
          parsedJson.forEach((rawTrace: any) => {
            const spans = convertFromZipkinTrace(rawTrace);
            const trace = new Trace(spans);
            this.stage.addTrace(trace);
          });
        } else if (isObject(parsedJson[0])) {
          const spans = convertFromZipkinTrace(parsedJson);
          const trace = new Trace(spans);
          this.stage.addTrace(trace);
        } else {
          errorMessages.push(`${file.name}: Unrecognized Zipkin format`);
          continue;
        }
      }
    }

    if (errorMessages.length > 0) {
      const text = `Following errors occured while importing:
        <ul>${errorMessages.map(m => `<li>${m}</li>`).join('')}</ul>`;
      new Noty({
        text,
        type: 'error',
        theme: 'bootstrap-v4'
      }).show();
    }
  }

  // Sorry for the partial duplication of `onDrop()` method
  private openFiles(
    files: { name: string; content?: string; error?: string }[]
  ) {
    const errorMessages = [] as string[];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.error) {
        errorMessages.push(`${file.name}: ${file.error}`);
        continue;
      }

      if (!file.content) {
        errorMessages.push(`${file.name}: Empty content`);
        continue;
      }

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(file.content);
      } catch (err) {
        errorMessages.push(`${file.name}: Invalid JSON`);
        continue;
      }

      const isJaeger = isJaegerJSON(parsedJson);
      const isZipkin = isZipkinJSON(parsedJson);

      if (!isJaeger && !isZipkin) {
        errorMessages.push(`${file.name}: Unrecognized Jaeger/Zipkin JSON`);
        continue;
      }

      if (isJaeger) {
        parsedJson.data.forEach((rawTrace: any) => {
          const spans = convertFromJaegerTrace(rawTrace);
          const trace = new Trace(spans);
          this.stage.addTrace(trace);
        });
      }

      if (isZipkin) {
        if (isArray(parsedJson[0])) {
          parsedJson.forEach((rawTrace: any) => {
            const spans = convertFromZipkinTrace(rawTrace);
            const trace = new Trace(spans);
            this.stage.addTrace(trace);
          });
        } else if (isObject(parsedJson[0])) {
          const spans = convertFromZipkinTrace(parsedJson);
          const trace = new Trace(spans);
          this.stage.addTrace(trace);
        } else {
          errorMessages.push(`${file.name}: Unrecognized Zipkin format`);
          continue;
        }
      }
    }

    if (errorMessages.length > 0) {
      const text = `Following errors occured while importing:
        <ul>${errorMessages.map(m => `<li>${m}</li>`).join('')}</ul>`;
      new Noty({
        text,
        type: 'error',
        theme: 'bootstrap-v4'
      }).show();
    }
  }

  private onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dropZoneEl.style.display = 'block';
  }

  private onDragLeave(e: DragEvent) {
    this.dropZoneEl.style.display = 'none';
  }

  private async showSpanInTableView(spanId: string) {
    if (!spanId) return;
    await this.spansTable.clearSearch();
    this.spansTable.selectSpan(spanId);
    this.dockPanel.activateWidget(this.widgets[AppWidgetType.SPANS_TABLE]);

    // When spans-table is opening first time, it needs a little time
    // to catch-up to scroll to row.
    setTimeout(() => this.spansTable.focusSpan(spanId), 100);
  }

  private showSpanInTimelineView(spanId: string) {
    if (!spanId) return;
    this.timeline.timeline.selectSpan(spanId, true);
    this.timeline.timeline.focusSpans([spanId]);
    this.dockPanel.activateWidget(this.widgets[AppWidgetType.TIMELINE_VIEW]);
  }

  dispose() {
    window.removeEventListener('resize', this.binded.onWindowResize, false);
    this.options.element.removeEventListener('drop', this.binded.onDrop, false);
    this.options.element.removeEventListener(
      'dragover',
      this.binded.onDragOver,
      false
    );
    this.dropZoneEl.removeEventListener(
      'dragleave',
      this.binded.onDragLeave,
      false
    );
    this.contextMenuManager.removeListener(
      ContextMenuEvent.SHOW_SPAN_IN_TABLE_VIEW,
      this.binded.showSpanInTableView
    );
    this.contextMenuManager.removeListener(
      ContextMenuEvent.SHOW_SPAN_IN_TIMELINE_VIEW,
      this.binded.showSpanInTimelineView
    );

    this.toolbar.dispose();
    this.toolbar = null;
    this.timeline.dispose();
    this.timeline = null;
    this.options = null;
  }
}

async function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onerror = reject;
    fileReader.onload = () => resolve(fileReader.result as string);
    fileReader.readAsText(file);
  });
}
