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
import Noty from 'noty';
import { isJaegerJSON, convertFromJaegerTrace } from './model/api/jaeger/span';
import { isZipkinJSON, convertFromZipkinTrace } from './model/api/zipkin/span';
import { TypeScriptManager } from './components/customization/typescript-manager';
import { ipcRenderer } from 'electron';
import { SpanSummaryView } from './components/span-summary/span-summary';
import { SpanTagsView } from './components/span-tags/span-tags';
import { SpanProcessTagsView } from './components/span-process-tags/span-process-tags';
import { SpanLogsView } from './components/span-logs/span-logs';
import { SpansTableView } from './components/spans-table/spans-table';
import { LogsTableView } from './components/logs-table/logs-table';
import {
  ContextMenuManager,
  ContextMenuEvent
} from './components/ui/context-menu/context-menu-manager';
import { opentracing, stalk } from 'stalk-opentracing';
import { StalkCustomReporter } from './utils/stalk-custom-reporter';

import 'tippy.js/dist/tippy.css';
import 'noty/lib/noty.css';
import 'noty/lib/themes/bootstrap-v4.css';
import './app.css';

export enum AppWidgetType {
  TIMELINE = 'timeline-view',
  SPANS_TABLE = 'spans-table',
  LOGS_TABLE = 'logs-table',
  SPAN_SUMMARY = 'span-summary',
  SPAN_TAGS = 'span-tags',
  SPAN_PROCESS_TAGS = 'span-process-tags',
  SPAN_LOGS = 'span-logs'
}

export interface AppOptions {
  element: HTMLDivElement;
}

@stalk.decorators.Tag.Component('app')
export class App {
  private stage = Stage.getSingleton();
  private contextMenuManager = ContextMenuManager.getSingleton();
  private toolbar = new AppToolbar({});
  private timeline = new TimelineWrapper();
  private spanSummary = new SpanSummaryView();
  private spanTags = new SpanTagsView();
  private spanProcessTags = new SpanProcessTagsView();
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
    onDrop: this.onDrop.bind(this),
    onDragOver: this.onDragOver.bind(this),
    onDragLeave: this.onDragLeave.bind(this),
    showSpanInTableView: this.showSpanInTableView.bind(this),
    showSpanInTimelineView: this.showSpanInTimelineView.bind(this)
  };

  constructor(private options: AppOptions) {
    // Noop
  }

  @stalk.decorators.Trace.TraceAsync({
    operationName: 'app.init',
    relation: 'newTrace'
  })
  async init(ctx: opentracing.Span) {
    // Init managers related with db
    await Promise.all([
      DataSourceManager.getSingleton().init(ctx),
      SpanGroupingManager.getSingleton().init(ctx),
      SpanColoringManager.getSingleton().init(ctx),
      SpanLabellingManager.getSingleton().init(ctx),
      TypeScriptManager.getSingleton().init(ctx)
    ]);

    this.contextMenuManager.init();
    this.initDockPanelAndWidgets(ctx);

    this.toolbar.mount(this.options.element);

    const timelineWidgetEl = this.widgets[AppWidgetType.TIMELINE].node;
    this.timeline.mount(timelineWidgetEl);
    const { offsetWidth: w1, offsetHeight: h1 } = timelineWidgetEl;
    this.timeline.init(ctx, { width: w1, height: h1 });
    this.toolbar.init(ctx); // Needs dsManager

    const spansTableWidgetEl = this.widgets[AppWidgetType.SPANS_TABLE].node;
    this.spansTable.mount(spansTableWidgetEl);
    const { offsetWidth: w4, offsetHeight: h4 } = spansTableWidgetEl;
    this.spansTable.init(ctx, { width: w4, height: h4 });

    const logsTableWidgetEl = this.widgets[AppWidgetType.LOGS_TABLE].node;
    this.logsTable.mount(logsTableWidgetEl);
    const { offsetWidth: w5, offsetHeight: h5 } = logsTableWidgetEl;
    this.logsTable.init(ctx, { width: w5, height: h5 });

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

    const spanProcessTagsWidgetEl = this.widgets[
      AppWidgetType.SPAN_PROCESS_TAGS
    ].node;
    this.spanProcessTags.mount(spanProcessTagsWidgetEl);
    this.spanProcessTags.init({
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

    // Listen for electron's full-screen events
    ipcRenderer.on('enter-full-screen', () =>
      document.body.classList.add('full-screen')
    );
    ipcRenderer.on('leave-full-screen', () =>
      document.body.classList.remove('full-screen')
    );

    // Listen for electron's `open-file` events
    ipcRenderer.on('open-file', (event, arg) => {
      this.openFiles([arg]);
    });
    ipcRenderer.once('app-initalized-response', (event, arg) => {
      this.openFiles(arg.openFiles);
    });

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

    // Send event to main process that app is done initalizing
    ipcRenderer.send('app-initalized');
  }

  @stalk.decorators.Trace.Trace({
    operationName: 'app.initDockPanelAndWidgets',
    relation: 'childOf',
    autoFinish: true
  })
  private initDockPanelAndWidgets(ctx: opentracing.Span) {
    this.dockPanel.id = 'app-dock-panel';

    this.widgets[AppWidgetType.TIMELINE] = new WidgetWrapper({
      title: 'Timeline View',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.onTimelineWidgetResize(null, msg);
      }, 100),
      closable: false
    });

    this.widgets[AppWidgetType.SPANS_TABLE] = new WidgetWrapper({
      title: 'Spans Table View',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.spansTable.resize(msg.width, msg.height);
      }, 100),
      onAfterShow: () => this.spansTable.redrawTable(),
      closable: false
    });

    this.widgets[AppWidgetType.LOGS_TABLE] = new WidgetWrapper({
      title: 'Logs Table View',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.logsTable.resize(msg.width, msg.height);
      }, 100),
      onAfterShow: () => this.logsTable.redrawTable(),
      closable: false
    });

    this.widgets[AppWidgetType.SPAN_SUMMARY] = new WidgetWrapper({
      title: 'Span Summary',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.spanSummary.resize(msg.width, msg.height);
      }, 100),
      closable: false
    });

    this.widgets[AppWidgetType.SPAN_TAGS] = new WidgetWrapper({
      title: 'Span Tags',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.spanTags.resize(msg.width, msg.height);
      }, 100),
      closable: false
    });

    this.widgets[AppWidgetType.SPAN_PROCESS_TAGS] = new WidgetWrapper({
      title: 'Process Tags',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.spanProcessTags.resize(msg.width, msg.height);
      }, 100),
      closable: false
    });

    this.widgets[AppWidgetType.SPAN_LOGS] = new WidgetWrapper({
      title: 'Span Logs',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.spanLogs.resize(msg.width, msg.height);
      }, 100),
      closable: false
    });

    this.dockPanel.restoreLayout({
      main: {
        children: [
          {
            type: 'tab-area',
            currentIndex: 0,
            widgets: [
              this.widgets[AppWidgetType.TIMELINE],
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
                widgets: [
                  this.widgets[AppWidgetType.SPAN_TAGS],
                  this.widgets[AppWidgetType.SPAN_PROCESS_TAGS]
                ]
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

  @stalk.decorators.Trace.Trace({
    operationName: 'app.onStageTraceAdded',
    relation: 'followsFrom',
    autoFinish: true
  })
  private onStageTraceAdded(ctx: opentracing.Span, trace: Trace) {
    this.timeline.addTrace(ctx, trace);
  }

  @stalk.decorators.Trace.Trace({
    operationName: 'app.onStageTraceRemoved',
    relation: 'followsFrom',
    autoFinish: true
  })
  private onStageTraceRemoved(ctx: opentracing.Span, trace: Trace) {
    this.timeline.removeTrace(ctx, trace);
  }

  private onWindowResize() {
    this.dockPanel.update();
  }

  @stalk.decorators.Trace.Trace({
    operationName: 'app.onTimelineWidgetResize',
    relation: 'newTrace',
    autoFinish: true
  })
  private onTimelineWidgetResize(
    ctx: opentracing.Span,
    msg: { width: number; height: number }
  ) {
    this.timeline.resize(ctx, msg.width, msg.height);
  }

  private initDropZone() {
    this.dropZoneEl.id = 'drop-zone';
    // Drop zone should not have any children, it causes unexpected dragleave/dragover events
    // https://stackoverflow.com/questions/20958176/why-is-dragleave-event-firing-unexpectedly
    // That's why we seperate border and overlay text
    this.dropZoneEl.innerHTML = `<div class="border"></div>
      <div class="overlay-text">Drop Jaeger or Zipkin trace(s) here</div>`;
    this.options.element.appendChild(this.dropZoneEl);
  }

  private async onDrop(e: DragEvent) {
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
          this.stage.addTrace(null, trace);
        });
      }

      if (isZipkin) {
        if (isArray(parsedJson[0])) {
          parsedJson.forEach((rawTrace: any) => {
            const spans = convertFromZipkinTrace(rawTrace);
            const trace = new Trace(spans);
            this.stage.addTrace(null, trace);
          });
        } else if (isObject(parsedJson[0])) {
          const spans = convertFromZipkinTrace(parsedJson);
          const trace = new Trace(spans);
          this.stage.addTrace(null, trace);
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
          this.stage.addTrace(null, trace);
        });
      }

      if (isZipkin) {
        if (isArray(parsedJson[0])) {
          parsedJson.forEach((rawTrace: any) => {
            const spans = convertFromZipkinTrace(rawTrace);
            const trace = new Trace(spans);
            this.stage.addTrace(null, trace);
          });
        } else if (isObject(parsedJson[0])) {
          const spans = convertFromZipkinTrace(parsedJson);
          const trace = new Trace(spans);
          this.stage.addTrace(null, trace);
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
    this.dockPanel.activateWidget(this.widgets[AppWidgetType.TIMELINE]);
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

// This block enables self-tracing
if (false) {
  const tracer = new stalk.Tracer();
  const customReporter = new StalkCustomReporter();
  (window as any).reporter = customReporter;
  tracer.addReporter(customReporter);
  opentracing.initGlobalTracer(tracer);
}
