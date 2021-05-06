import { AppToolbar } from './components/app-toolbar/app-toolbar';
import throttle from 'lodash/throttle';
import debounce from 'lodash/debounce';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import { DataSourceManager } from './model/datasource/manager';
import { SpanGroupingManager } from './model/span-grouping/manager';
import { SpanColoringManager } from './model/span-coloring-manager';
import { SpanLabellingManager } from './model/span-labelling-manager';
import { Trace } from './model/trace';
import { Stage, StageEvent } from './model/stage';
import { TimelineWrapper } from './components/timeline-wrapper/timeline-wrapper';
import { TimelineViewEvent } from './components/timeline/timeline-view';
import { DockPanel } from '@phosphor/widgets';
import { WidgetWrapper } from './components/ui/widget-wrapper';
import Noty from 'noty';
import { isJaegerJSON, convertFromJaegerTrace } from './model/jaeger';
import { isZipkinJSON, convertFromZipkinTrace } from './model/zipkin';
import { TypeScriptManager } from './components/customization/typescript-manager';
import { SpanSummaryView } from './components/span-summary/span-summary';
import { SpanTagsView } from './components/span-tags/span-tags';
import { SpanProcessTagsView } from './components/span-process-tags/span-process-tags';
import { SpanLogsView } from './components/span-logs/span-logs';
import {
  SpansTableView,
  SpansTableViewEvent,
} from './components/spans-table/spans-table';
import {
  ContextMenuManager,
  ContextMenuEvent,
} from './components/ui/context-menu/context-menu-manager';
import * as fs from 'fs';
import * as path from 'path';
import format from 'date-fns/format';
import { SettingsManager, SettingsKey } from './model/settings-manager';
import { DataSource, DataSourceType } from './model/datasource/interfaces';
import { JaegerSearch } from './components/trace-search/jaeger-search';
import { ZipkinSearch } from './components/trace-search/zipkin-search';

import 'tippy.js/dist/tippy.css';
import 'noty/lib/noty.css';
import 'flatpickr/dist/flatpickr.min.css';
import './app.css';
import './global-styles/dock-panel.css';
import './global-styles/noty.css';
import './global-styles/flatpickr.css';
import './global-styles/form.css';

// DO NOT change these string, they're used for
// remembering & saving dock layout!
export enum AppWidgetType {
  TIMELINE = 'timeline-view',
  SPANS_TABLE = 'spans-table',
  SPAN_SUMMARY = 'span-summary',
  SPAN_TAGS = 'span-tags',
  SPAN_PROCESS_TAGS = 'span-process-tags',
  SPAN_LOGS = 'span-logs',
}

export interface AppOptions {
  element: HTMLDivElement;
}

export class App {
  private stage = Stage.getSingleton();
  private contextMenuManager = ContextMenuManager.getSingleton();
  private settingsManager = SettingsManager.getSingleton();
  private timeline = new TimelineWrapper();
  private spanSummary = new SpanSummaryView();
  private spanTags = new SpanTagsView();
  private spanProcessTags = new SpanProcessTagsView();
  private spanLogs = new SpanLogsView();
  private spansTable = new SpansTableView();

  private dockPanel = new DockPanel();
  private widgets: { [key: string]: WidgetWrapper } = {};
  private dropZoneEl = document.createElement('div');

  private dataSourceSearchWidgets: {
    [key: string]: {
      dataSource: DataSource;
      widgetWrapper: WidgetWrapper;
      component: JaegerSearch | ZipkinSearch;
    };
  } = {};

  private binded = {
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    onTimelineSpanSelected: this.onTimelineSpanSelected.bind(this),
    onSpansTableSpanSelected: this.onSpansTableSpanSelected.bind(this),
    onWindowResize: this.onWindowResize.bind(this),
    onDrop: this.onDrop.bind(this),
    onDragOver: this.onDragOver.bind(this),
    onDragLeave: this.onDragLeave.bind(this),
    showSpanInTableView: this.showSpanInTableView.bind(this),
    showSpanInTimelineView: this.showSpanInTimelineView.bind(this),
    onKeyDown: this.onKeyDown.bind(this),
    onToolbarDataSourceClick: this.onToolbarDataSourceClick.bind(this),
  };

  private toolbar = new AppToolbar({
    onDataSourceClick: this.binded.onToolbarDataSourceClick,
  });

  constructor(private options: AppOptions) {
    // Noop
  }

  async init() {
    // Init managers related with db
    await Promise.all([
      SettingsManager.getSingleton().init(),
      DataSourceManager.getSingleton().init(),
      SpanGroupingManager.getSingleton().init(),
      SpanColoringManager.getSingleton().init(),
      SpanLabellingManager.getSingleton().init(),
      TypeScriptManager.getSingleton().init(),
    ]);

    this.contextMenuManager.init();
    this.initDockPanelAndWidgets();

    this.toolbar.mount(this.options.element);

    const timelineWidgetEl = this.widgets[AppWidgetType.TIMELINE].node;
    this.timeline.mount(timelineWidgetEl);
    const { offsetWidth: w1, offsetHeight: h1 } = timelineWidgetEl;
    this.timeline.init({ width: w1, height: h1 });
    this.toolbar.init(); // Needs dsManager

    const spansTableWidgetEl = this.widgets[AppWidgetType.SPANS_TABLE].node;
    this.spansTable.mount(spansTableWidgetEl);
    const { offsetWidth: w4, offsetHeight: h4 } = spansTableWidgetEl;
    this.spansTable.init({ width: w4, height: h4 });

    const spanSummaryWidgetEl = this.widgets[AppWidgetType.SPAN_SUMMARY].node;
    this.spanSummary.mount(spanSummaryWidgetEl);
    this.spanSummary.init({
      timeline: this.timeline.timeline,
      spansTable: this.spansTable,
    });

    const spanTagsWidgetEl = this.widgets[AppWidgetType.SPAN_TAGS].node;
    this.spanTags.mount(spanTagsWidgetEl);
    this.spanTags.init({
      timeline: this.timeline.timeline,
      spansTable: this.spansTable,
    });

    const spanProcessTagsWidgetEl = this.widgets[
      AppWidgetType.SPAN_PROCESS_TAGS
    ].node;
    this.spanProcessTags.mount(spanProcessTagsWidgetEl);
    this.spanProcessTags.init({
      timeline: this.timeline.timeline,
      spansTable: this.spansTable,
    });

    const spanLogsWidgetEl = this.widgets[AppWidgetType.SPAN_LOGS].node;
    this.spanLogs.mount(spanLogsWidgetEl);
    this.spanLogs.init({
      timeline: this.timeline.timeline,
      spansTable: this.spansTable,
    });

    this.initDropZone();

    // Bind events
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    this.timeline.timeline.on(
      TimelineViewEvent.SPAN_SELECTED,
      this.binded.onTimelineSpanSelected
    );
    this.spansTable.on(
      SpansTableViewEvent.SPAN_SELECTED,
      this.binded.onSpansTableSpanSelected
    );
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
    document.addEventListener('keydown', this.binded.onKeyDown, false);

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

    window.Countly.add_event({
      key: 'ready',
      count: 1,
      segmentation: {},
    });
  }

  private initDockPanelAndWidgets() {
    this.dockPanel.id = 'app-dock-panel';

    this.widgets[AppWidgetType.TIMELINE] = new WidgetWrapper({
      title: 'Timeline View',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.onTimelineWidgetResize(msg);
      }, 100),
      closable: false,
    });

    this.widgets[AppWidgetType.SPANS_TABLE] = new WidgetWrapper({
      title: 'Table View',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.spansTable.resize(msg.width, msg.height);
      }, 100),
      onAfterShow: () => this.spansTable.redrawTable(),
      closable: false,
    });

    this.widgets[AppWidgetType.SPAN_SUMMARY] = new WidgetWrapper({
      title: 'Span Summary',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.spanSummary.resize(msg.width, msg.height);
      }, 100),
      closable: false,
    });

    this.widgets[AppWidgetType.SPAN_TAGS] = new WidgetWrapper({
      title: 'Span Tags',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.spanTags.resize(msg.width, msg.height);
      }, 100),
      closable: false,
    });

    this.widgets[AppWidgetType.SPAN_PROCESS_TAGS] = new WidgetWrapper({
      title: 'Process Tags',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.spanProcessTags.resize(msg.width, msg.height);
      }, 100),
      closable: false,
    });

    this.widgets[AppWidgetType.SPAN_LOGS] = new WidgetWrapper({
      title: 'Span Logs',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.spanLogs.resize(msg.width, msg.height);
      }, 100),
      closable: false,
    });

    this.dockPanel.restoreLayout(this.getDockPanelLayout() as any);
    DockPanel.attach(this.dockPanel, this.options.element);
  }

  private onStageTraceAdded(trace: Trace) {
    this.timeline.addTrace(trace);
  }

  private onStageTraceRemoved(trace: Trace) {
    this.timeline.removeTrace(trace);

    Object.values(this.dataSourceSearchWidgets).forEach(({ component }) => {
      component.reloadTableData();
    });
  }

  private onTimelineSpanSelected(spanId: string) {
    this.spansTable.selectSpan(spanId, true);
    this.spansTable.focusSpan(spanId);
  }

  private onSpansTableSpanSelected(spanId: string) {
    this.timeline.timeline.selectSpan(spanId, true);
    this.timeline.timeline.focusSpans([spanId]);
  }

  private onWindowResize() {
    this.dockPanel.update();
  }

  private onTimelineWidgetResize(msg: { width: number; height: number }) {
    this.timeline.resize(msg.width, msg.height);
  }

  private initDropZone() {
    this.dropZoneEl.id = 'drop-zone';
    // Drop zone should not have any children, it causes unexpected dragleave/dragover events
    // https://stackoverflow.com/questions/20958176/why-is-dragleave-event-firing-unexpectedly
    // That's why we seperate border and overlay text
    this.dropZoneEl.innerHTML = `<div class="border"></div>
      <div class="overlay-text">Drop JSON trace file(s) here</div>`;
    this.options.element.appendChild(this.dropZoneEl);
  }

  private async onDrop(e: DragEvent) {
    e.preventDefault();
    this.dropZoneEl.style.display = 'none';
    const errorMessages = [] as string[];

    // You have to perform async (reading file) task in parallel,
    // if not `e.dataTransfer` will be released from memory on next
    // iteration, you can't access it.
    const tasks = Array.from(e.dataTransfer.items).map(async (item) => {
      // If dropped items aren't files, reject them
      if (item.kind != 'file') {
        errorMessages.push('Only files can be dropped');
        return;
      }

      const file = item.getAsFile();
      if (file.type != 'application/json') {
        errorMessages.push(`${file.name}: Not a JSON file`);
        return;
      }

      let fileContent = '';
      try {
        fileContent = await readFile(file);
      } catch (err) {
        errorMessages.push(
          `${file.name}: Could not read its content -- ${err.message}`
        );
        return;
      }

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(fileContent);
      } catch (err) {
        errorMessages.push(`${file.name}: Invalid JSON`);
        return;
      }

      try {
        this.openDroppedJSONFiles(parsedJson);
      } catch (err) {
        errorMessages.push(`${file.name}: ${err.message}`);
      }
    });

    await Promise.all(tasks);

    if (errorMessages.length > 0) {
      const text = `Following errors occured while importing:
        <ul>${errorMessages.map((m) => `<li>${m}</li>`).join('')}</ul>`;
      new Noty({
        text,
        type: 'error',
      }).show();
    }

    window.Countly.add_event({
      key: 'json_file_dropped',
      count: 1,
      segmentation: {
        errorCount: errorMessages.length,
      },
    });
  }

  private onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dropZoneEl.style.display = 'block';
  }

  private onDragLeave(e: DragEvent) {
    this.dropZoneEl.style.display = 'none';
  }

  private openDroppedJSONFiles(parsedJson: any) {
    if (isJaegerJSON(parsedJson)) {
      parsedJson.data.forEach((rawTrace: any) => {
        const spans = convertFromJaegerTrace(rawTrace);
        const trace = new Trace(spans);
        this.stage.addTrace(trace);
      });

      window.Countly.add_event({
        key: 'trace_added_from_json_file',
        count: 1,
        segmentation: {
          type: 'jaeger',
          traceCount: parsedJson.data.length,
        },
      });

      return;
    }

    if (isZipkinJSON(parsedJson)) {
      if (isArray(parsedJson[0])) {
        parsedJson.forEach((rawTrace: any) => {
          const spans = convertFromZipkinTrace(rawTrace);
          const trace = new Trace(spans);
          this.stage.addTrace(trace);
        });

        window.Countly.add_event({
          key: 'trace_added_from_json_file',
          count: 1,
          segmentation: {
            type: 'zipkin',
            traceCount: parsedJson.length,
          },
        });

        return;
      }

      if (isObject(parsedJson[0])) {
        const spans = convertFromZipkinTrace(parsedJson);
        const trace = new Trace(spans);
        this.stage.addTrace(trace);

        window.Countly.add_event({
          key: 'trace_added_from_json_file',
          count: 1,
          segmentation: {
            type: 'zipkin',
            traceCount: 1,
          },
        });

        return;
      }

      throw new Error(`Unrecognized Zipkin format`);
    }

    window.Countly.add_event({
      key: 'unrecognized_json_file',
      count: 1,
      segmentation: {},
    });

    throw new Error(`Unrecognized JSON file`);
  }

  private async showSpanInTableView(spanId: string) {
    if (!spanId) return;
    await this.spansTable.removeFilter();
    this.spansTable.selectSpan(spanId, true);
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

  private onKeyDown(e: KeyboardEvent) {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    // CMD + A => Prevent selection all the selected texts
    if (e.key == 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      return;
    }
  }

  private onToolbarDataSourceClick(dataSource: DataSource) {
    if (this.dataSourceSearchWidgets[dataSource.id]) {
      const widgetWrapper = this.dataSourceSearchWidgets[dataSource.id]
        .widgetWrapper;
      this.dockPanel.activateWidget(widgetWrapper);
      return;
    }

    let component: JaegerSearch | ZipkinSearch;
    if (dataSource.type == DataSourceType.JAEGER) {
      component = new JaegerSearch({
        dataSource,
        onTracesAdd: (traces: Trace[]) => {
          traces.forEach((t) => this.stage.addTrace(t));
          this.dockPanel.activateWidget(this.widgets[AppWidgetType.TIMELINE]);

          window.Countly.add_event({
            key: 'trace_added_from_data_source',
            count: 1,
            segmentation: {
              type: 'jaeger',
              traceCount: traces.length,
            },
          });
        },
      });
    } else if (dataSource.type == DataSourceType.ZIPKIN) {
      component = new ZipkinSearch({
        dataSource,
        onTracesAdd: (traces: Trace[]) => {
          traces.forEach((t) => this.stage.addTrace(t));
          this.dockPanel.activateWidget(this.widgets[AppWidgetType.TIMELINE]);

          window.Countly.add_event({
            key: 'trace_added_from_data_source',
            count: 1,
            segmentation: {
              type: 'zipkin',
              traceCount: traces.length,
            },
          });
        },
      });
    } else {
      throw new Error(`Unexpected data source type "${dataSource.type}"`);
    }

    const widgetWrapper = new WidgetWrapper({
      title: `Search: ${dataSource.name}`,
      onResize: throttle(() => component.resize(), 100),
      onAfterShow: () => component.onShow(),
      closable: true,
      onClose: () => {
        component.dispose();
        delete this.dataSourceSearchWidgets[dataSource.id];
      },
    });
    widgetWrapper.node.appendChild(component.getElement());
    this.dockPanel.addWidget(widgetWrapper);
    component.init();
    this.dockPanel.activateWidget(widgetWrapper);

    this.dataSourceSearchWidgets[dataSource.id] = {
      dataSource,
      widgetWrapper,
      component,
    };
  }

  private getDockPanelLayout() {
    return {
      main: {
        children: [
          {
            type: 'tab-area',
            currentIndex: 0,
            widgets: [
              this.widgets[AppWidgetType.TIMELINE],
              this.widgets[AppWidgetType.SPANS_TABLE],
            ],
          },
          {
            type: 'split-area',
            orientation: 'horizontal',
            sizes: [0.33, 0.33, 0.33],
            children: [
              {
                type: 'tab-area',
                currentIndex: 0,
                widgets: [this.widgets[AppWidgetType.SPAN_SUMMARY]],
              },
              {
                type: 'tab-area',
                currentIndex: 0,
                widgets: [
                  this.widgets[AppWidgetType.SPAN_TAGS],
                  this.widgets[AppWidgetType.SPAN_PROCESS_TAGS],
                ],
              },
              {
                type: 'tab-area',
                currentIndex: 0,
                widgets: [this.widgets[AppWidgetType.SPAN_LOGS]],
              },
            ],
          },
        ],
        orientation: 'vertical',
        sizes: [0.7, 0.3],
        type: 'split-area',
      },
    };
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
    document.removeEventListener('keydown', this.binded.onKeyDown, false);

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
