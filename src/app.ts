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
import { DockPanel } from 'phosphor-dockpanel';
import { WidgetWrapper } from './components/ui/widget-wrapper';
import { LogsDataView } from './components/logs-data-view/logs-data-view';
import Noty from 'noty';
import { isJaegerJSON, convertFromJaegerTrace } from './model/api/jaeger/span';
import { isZipkinJSON, convertFromZipkinTrace } from './model/api/zipkin/span';
import { TypeScriptManager } from './components/customization/typescript-manager';

import 'tippy.js/dist/tippy.css';
import 'noty/lib/noty.css';
import 'noty/lib/themes/bootstrap-v4.css';
import './app.css';

export enum AppWidgetType {
  TIMELINE_VIEW = 'timeline-view',
  LOGS_DATA_VIEW = 'logs-data-view',
  SPANS_DATA_VIEW = 'spans-data-view'
}

export interface AppOptions {
  element: HTMLDivElement;
}

export class App {
  private stage = Stage.getSingleton();
  private toolbar = new AppToolbar({});
  private timeline = new TimelineWrapper();
  private logsData = new LogsDataView();

  private dockPanel = new DockPanel();
  private widgets: { [key: string]: WidgetWrapper } = {};
  private dropZoneEl = document.createElement('div');

  private binded = {
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    onWindowResize: this.onWindowResize.bind(this),
    onTimelineResize: this.onTimelineResize.bind(this),
    onLogsDataResize: throttle(this.onLogsDataResize.bind(this), 100),
    onDrop: this.onDrop.bind(this),
    onDragOver: this.onDragOver.bind(this),
    onDragLeave: this.onDragLeave.bind(this)
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
      TypeScriptManager.getSingleton().init()
    ]);

    this.initDockPanelAndWidgets();
    const timelineWidgetEl = this.widgets[AppWidgetType.TIMELINE_VIEW].node;
    const logsWidgetEl = this.widgets[AppWidgetType.LOGS_DATA_VIEW].node;

    this.toolbar.mount(this.options.element);
    this.timeline.mount(timelineWidgetEl);
    this.logsData.mount(logsWidgetEl);

    const { offsetWidth: w1, offsetHeight: h1 } = timelineWidgetEl;
    this.timeline.init({ width: w1, height: h1 });
    this.toolbar.init(); // Needs dsManager

    const { offsetWidth: w2, offsetHeight: h2 } = logsWidgetEl;
    this.logsData.init({ width: w2, height: h2 });

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

    this.dockPanel.insertTop(this.widgets[AppWidgetType.TIMELINE_VIEW]);
    this.dockPanel.insertBottom(this.widgets[AppWidgetType.LOGS_DATA_VIEW]);

    this.dockPanel.attach(this.options.element);
  }

  onStageTraceAdded(trace: Trace) {
    this.timeline.timeline.addTrace(trace);
  }

  onStageTraceRemoved(trace: Trace) {
    this.timeline.timeline.removeTrace(trace);
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

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dropZoneEl.style.display = 'block';
  }

  onDragLeave(e: DragEvent) {
    this.dropZoneEl.style.display = 'none';
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
