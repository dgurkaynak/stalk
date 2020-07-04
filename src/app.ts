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
import { ipcRenderer, remote, shell } from 'electron';
import { SpanSummaryView } from './components/span-summary/span-summary';
import { SpanTagsView } from './components/span-tags/span-tags';
import { SpanProcessTagsView } from './components/span-process-tags/span-process-tags';
import { SpanLogsView } from './components/span-logs/span-logs';
import {
  SpansTableView,
  SpansTableViewEvent,
} from './components/spans-table/spans-table';
import {
  LogsTableView,
  LogsTableViewEvent,
} from './components/logs-table/logs-table';
import {
  ContextMenuManager,
  ContextMenuEvent,
} from './components/ui/context-menu/context-menu-manager';
import * as fs from 'fs';
import * as path from 'path';
import format from 'date-fns/format';
import { SettingsManager, SettingsKey } from './model/settings-manager';

import 'tippy.js/dist/tippy.css';
import 'noty/lib/noty.css';
import 'flatpickr/dist/flatpickr.min.css';
import './app.css';

const { Menu } = remote;

// DO NOT change these string, they're used for
// remembering & saving dock layout!
export enum AppWidgetType {
  TIMELINE = 'timeline-view',
  SPANS_TABLE = 'spans-table',
  LOGS_TABLE = 'logs-table',
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
  private toolbar = new AppToolbar();
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
    onTimelineSpanSelected: this.onTimelineSpanSelected.bind(this),
    onSpansTableSpanSelected: this.onSpansTableSpanSelected.bind(this),
    onLogsTableLogSelected: this.onLogsTableLogSelected.bind(this),
    onWindowResize: this.onWindowResize.bind(this),
    onDrop: this.onDrop.bind(this),
    onDragOver: this.onDragOver.bind(this),
    onDragLeave: this.onDragLeave.bind(this),
    showSpanInTableView: this.showSpanInTableView.bind(this),
    showSpanInTimelineView: this.showSpanInTimelineView.bind(this),
    onKeyDown: this.onKeyDown.bind(this),
    onImportMenuClick: this.onImportMenuClick.bind(this),
    onExportMenuClick: this.onExportMenuClick.bind(this),
    onDockPanelLayoutChange: debounce(
      this.onDockPanelLayoutChange.bind(this),
      2500
    ),
  };

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

    const logsTableWidgetEl = this.widgets[AppWidgetType.LOGS_TABLE].node;
    this.logsTable.mount(logsTableWidgetEl);
    const { offsetWidth: w5, offsetHeight: h5 } = logsTableWidgetEl;
    this.logsTable.init({ width: w5, height: h5 });

    const spanSummaryWidgetEl = this.widgets[AppWidgetType.SPAN_SUMMARY].node;
    this.spanSummary.mount(spanSummaryWidgetEl);
    this.spanSummary.init({
      timeline: this.timeline.timeline,
      spansTable: this.spansTable,
      logsTable: this.logsTable,
    });

    const spanTagsWidgetEl = this.widgets[AppWidgetType.SPAN_TAGS].node;
    this.spanTags.mount(spanTagsWidgetEl);
    this.spanTags.init({
      timeline: this.timeline.timeline,
      spansTable: this.spansTable,
      logsTable: this.logsTable,
    });

    const spanProcessTagsWidgetEl = this.widgets[
      AppWidgetType.SPAN_PROCESS_TAGS
    ].node;
    this.spanProcessTags.mount(spanProcessTagsWidgetEl);
    this.spanProcessTags.init({
      timeline: this.timeline.timeline,
      spansTable: this.spansTable,
      logsTable: this.logsTable,
    });

    const spanLogsWidgetEl = this.widgets[AppWidgetType.SPAN_LOGS].node;
    this.spanLogs.mount(spanLogsWidgetEl);
    this.spanLogs.init({
      timeline: this.timeline.timeline,
      spansTable: this.spansTable,
      logsTable: this.logsTable,
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
    this.logsTable.on(
      LogsTableViewEvent.LOG_SELECTED,
      this.binded.onLogsTableLogSelected
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

    // Add a class named as current platform to body
    // This is mainlu used for app-toolbar styling just for macOS
    // Check `app-toolbar.css` for details
    document.body.classList.add(process.platform);

    // Listen for electron's full-screen events
    ipcRenderer.on('enter-full-screen', () =>
      document.body.classList.add('full-screen')
    );
    ipcRenderer.on('leave-full-screen', () =>
      document.body.classList.remove('full-screen')
    );

    // Listen for electron's `open-file` events
    ipcRenderer.on('open-file', (event, arg) => {
      this.openRawTexts([arg]);
    });
    ipcRenderer.once('app-initalized-response', (event, arg) => {
      this.openRawTexts(arg.openFiles);
    });

    // Application menu
    this.setupApplicationMenu();

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
      title: 'Spans Table View',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.spansTable.resize(msg.width, msg.height);
      }, 100),
      onAfterShow: () => this.spansTable.redrawTable(),
      closable: false,
    });

    this.widgets[AppWidgetType.LOGS_TABLE] = new WidgetWrapper({
      title: 'Logs Table View',
      onResize: throttle((msg: { width: number; height: number }) => {
        this.logsTable.resize(msg.width, msg.height);
      }, 100),
      onAfterShow: () => this.logsTable.redrawTable(),
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

    const layout = this.deserializeDockPanelLayout(
      this.settingsManager.get(SettingsKey.DOCK_LAYOUT) ||
        this.getDefaultDockPanelLayout(),
      true
    );
    this.dockPanel.restoreLayout(layout);
    this.dockPanel.layoutModified.connect(this.binded.onDockPanelLayoutChange);
    DockPanel.attach(this.dockPanel, this.options.element);
  }

  private onStageTraceAdded(trace: Trace) {
    this.timeline.addTrace(trace);
  }

  private onStageTraceRemoved(trace: Trace) {
    this.timeline.removeTrace(trace);
  }

  private onTimelineSpanSelected(spanId: string) {
    this.spansTable.selectSpan(spanId, true);
    this.spansTable.focusSpan(spanId);

    this.logsTable.selectLog(null, true);
  }

  private onSpansTableSpanSelected(spanId: string) {
    this.timeline.timeline.selectSpan(spanId, true);
    this.timeline.timeline.focusSpans([spanId]);

    this.logsTable.selectLog(null, true);
  }

  private onLogsTableLogSelected(logData: any) {
    this.timeline.timeline.selectSpan(logData.span.id, true);
    this.timeline.timeline.focusSpans([logData.span.id]);

    this.spansTable.selectSpan(logData.span.id, true);
    this.spansTable.focusSpan(logData.span.id);
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
        this.openParsedJSON(parsedJson);
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
  }

  private onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dropZoneEl.style.display = 'block';
  }

  private onDragLeave(e: DragEvent) {
    this.dropZoneEl.style.display = 'none';
  }

  // Sorry for the partial duplication of `onDrop()` method
  private openRawTexts(
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

      try {
        this.openParsedJSON(parsedJson);
      } catch (err) {
        errorMessages.push(`${file.name}: ${err.message}`);
      }
    }

    if (errorMessages.length > 0) {
      const text = `Following errors occured while importing:
        <ul>${errorMessages.map((m) => `<li>${m}</li>`).join('')}</ul>`;
      new Noty({
        text,
        type: 'error',
      }).show();
    }
  }

  private openParsedJSON(parsedJson: any) {
    if (isJaegerJSON(parsedJson)) {
      parsedJson.data.forEach((rawTrace: any) => {
        const spans = convertFromJaegerTrace(rawTrace);
        const trace = new Trace(spans);
        this.stage.addTrace(trace);
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
        return;
      }

      if (isObject(parsedJson[0])) {
        const spans = convertFromZipkinTrace(parsedJson);
        const trace = new Trace(spans);
        this.stage.addTrace(trace);
        return;
      }

      throw new Error(`Unrecognized Zipkin format`);
    }

    if (isObject(parsedJson) && (parsedJson as any).kind == 'stalk-studio/v1') {
      if (isArray((parsedJson as any).traces)) {
        (parsedJson as any).traces.forEach((spans: any) => {
          const trace = new Trace(spans);
          this.stage.addTrace(trace);
        });
        return;
      }

      throw new Error(`Broken Stalk JSON - "traces" field does not exist`);
    }

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

  private setupApplicationMenu() {
    const isMac = process.platform === 'darwin';
    const template = [
      ...(isMac
        ? [
            {
              label: `Stalk Studio`,
              submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
              ],
            },
          ]
        : []),
      {
        label: 'File',
        submenu: [
          {
            label: 'Import Trace(s)',
            click: this.binded.onImportMenuClick,
          },
          {
            label: 'Export Stage',
            click: this.binded.onExportMenuClick,
          },
          ...(!isMac ? [{ type: 'separator' }, { role: 'quit' }] : []),
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          ...(isMac
            ? [
                { role: 'pasteAndMatchStyle' },
                { role: 'delete' },
                { role: 'selectAll' },
                { type: 'separator' },
                {
                  label: 'Speech',
                  submenu: [
                    { role: 'startspeaking' },
                    { role: 'stopspeaking' },
                  ],
                },
              ]
            : [
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' },
              ]),
        ],
      },
      {
        label: 'Window',
        submenu: [{ role: 'minimize' }, { role: 'zoom' }],
      },
      {
        role: 'help',
        submenu: [
          {
            label: 'GitHub Repo',
            click: async () =>
              await shell.openExternal(
                'https://github.com/dgurkaynak/stalk-studio/'
              ),
          },
          {
            label: 'Report Issue',
            click: async () =>
              await shell.openExternal(
                'https://github.com/dgurkaynak/stalk-studio/issues/new'
              ),
          },
          { type: 'separator' },
          { role: 'forcereload' },
          { role: 'toggledevtools' },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template as any);
    Menu.setApplicationMenu(menu);
  }

  private async onImportMenuClick() {
    const { canceled, filePaths } = await remote.dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled) return;

    const readFiles: { name: string; content: string }[] = [];
    const tasks = filePaths.map((filePath) => {
      const fileName = path.basename(filePath);
      return new Promise((resolve) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
            new Noty({
              text: `${fileName}: Could not read its content -- ${err.message}`,
              type: 'error',
            }).show();
          } else {
            readFiles.push({
              name: path.basename(filePath),
              content: data,
            });
          }
          resolve();
        });
      });
    });
    await Promise.all(tasks);

    this.openRawTexts(readFiles);
  }

  private async onExportMenuClick() {
    const traces = this.stage.getAllTraces();
    if (traces.length == 0) {
      new Noty({
        text: 'No traces in the stage',
        type: 'warning',
      }).show();
      return;
    }

    const downloadsFolder = remote.app.getPath('downloads');
    const fileName = `stalk-stage-${format(
      new Date(),
      'yyyy-MM-dd--HH-mm-ss'
    )}.json`;
    const { canceled, filePath } = await remote.dialog.showSaveDialog({
      defaultPath: path.join(downloadsFolder, fileName),
    });
    if (canceled) return;

    const fileContent = JSON.stringify(
      {
        kind: 'stalk-studio/v1',
        traces: traces.map((t) => t.spans),
      },
      null,
      2
    );

    fs.writeFile(filePath, fileContent, (err) => {
      if (err) {
        new Noty({
          text: err.message,
          type: 'error',
          timeout: 2500,
        }).show();
        return;
      }

      // Exported, no need to additonal notification
    });
  }

  private async onDockPanelLayoutChange() {
    const layout = this.serializeDockPanelLayout();
    await this.settingsManager.set(SettingsKey.DOCK_LAYOUT, layout);
  }

  private serializeDockPanelLayout(layout = this.dockPanel.saveLayout()) {
    const recursiveReplaceWidgets: any = (obj: { [key: string]: any }) => {
      // If we find target object
      if (obj.widgets && isArray(obj.widgets)) {
        const widgets = obj.widgets;

        // Mutate
        obj.widgets = widgets.map((widget) => {
          for (const widgetName in this.widgets) {
            if (this.widgets[widgetName] == widget) {
              return widgetName;
            }
          }

          console.error(`Cannot serialize dock layout, unknown widget`, widget);
          throw new Error(`Cannot serialize dock layout, unknown widget`);
        });

        return;
      }

      if (obj.children && isArray(obj.children)) {
        obj.children.forEach(recursiveReplaceWidgets);
        return;
      }
    };

    recursiveReplaceWidgets(layout.main);
    return layout;
  }

  private deserializeDockPanelLayout(layout: any, resetTabIndex = false) {
    const recursiveReplaceWidgets: any = (obj: { [key: string]: any }) => {
      // If we find target object
      if (obj.widgets && isArray(obj.widgets)) {
        const widgetNames = obj.widgets;

        if (resetTabIndex) {
          obj.currentIndex = 0;
        }

        // Mutate
        obj.widgets = widgetNames.map((widgetName) => {
          const widget = this.widgets[widgetName];
          if (!widget) {
            throw new Error(
              `Cannot deserialize dock layout, unknown widget: "${widgetName}"`
            );
          }
          return widget;
        });

        return;
      }

      if (obj.children && isArray(obj.children)) {
        obj.children.forEach(recursiveReplaceWidgets);
        return;
      }
    };

    recursiveReplaceWidgets(layout.main);
    return layout;
  }

  private getDefaultDockPanelLayout() {
    return {
      main: {
        children: [
          {
            type: 'tab-area',
            currentIndex: 0,
            widgets: [
              AppWidgetType.TIMELINE,
              AppWidgetType.SPANS_TABLE,
              AppWidgetType.LOGS_TABLE,
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
                widgets: [AppWidgetType.SPAN_SUMMARY],
              },
              {
                type: 'tab-area',
                currentIndex: 0,
                widgets: [
                  AppWidgetType.SPAN_TAGS,
                  AppWidgetType.SPAN_PROCESS_TAGS,
                ],
              },
              {
                type: 'tab-area',
                currentIndex: 0,
                widgets: [AppWidgetType.SPAN_LOGS],
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
    this.dockPanel.layoutModified.disconnect(
      this.binded.onDockPanelLayoutChange
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
