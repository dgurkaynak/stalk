import { AppToolbar } from './components/app-toolbar/app-toolbar';
import throttle from 'lodash/throttle';
import isNumber from 'lodash/isNumber';
import { DataSourceManager } from './model/datasource/manager';
import { SpanGroupingManager } from './model/span-grouping/manager';
import { SpanColoringManager } from './model/span-coloring-manager';
import { SpanLabellingManager } from './model/span-labelling-manager';
import { Trace } from './model/trace';
import { Stage, StageEvent } from './model/stage';
import { Timeline, TimelineEvent } from './components/timeline/timeline';
import { TimelineWrapper } from './components/timeline-wrapper/timeline-wrapper';
import { DockPanel } from 'phosphor-dockpanel';
import { WidgetWrapper } from './components/ui/widget-wrapper';
import { LogsData } from './components/logs-data/logs-data';

import 'tippy.js/dist/tippy.css';
import './app.css';

export enum AppWidgetType {
  TIMELINE = 'timeline',
  LOGS = 'logs',
  SPANS = 'spans',
  PROCESSES = 'processes'
}

export interface AppOptions {
  element: HTMLDivElement;
}

export class App {
  private stage = Stage.getSingleton();
  private toolbar = new AppToolbar({});
  private timeline = new TimelineWrapper();
  private logsData = new LogsData();

  private dockPanel = new DockPanel();
  private widgets: { [key: string]: WidgetWrapper } = {};

  private binded = {
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    onWindowResize: this.onWindowResize.bind(this),
    onTimelineResize: this.onTimelineResize.bind(this),
    onLogsDataResize: throttle(this.onLogsDataResize.bind(this), 100)
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
      SpanLabellingManager.getSingleton().init()
    ]);

    this.initDockPanelAndWidgets();
    const timelineWidgetEl = this.widgets[AppWidgetType.TIMELINE].node;
    const logsWidgetEl = this.widgets[AppWidgetType.LOGS].node;

    this.toolbar.mount(this.options.element);
    this.timeline.mount(timelineWidgetEl);
    this.logsData.mount(logsWidgetEl);

    const { offsetWidth: w1, offsetHeight: h1 } = timelineWidgetEl;
    this.timeline.init({ width: w1, height: h1 });
    this.toolbar.init(); // Needs dsManager

    const { offsetWidth: w2, offsetHeight: h2 } = logsWidgetEl;
    this.logsData.init({ width: w2, height: h2 });

    // Bind events
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    // TODO: Bind TimelineViewEvent.SPANS_SELECTED
    window.addEventListener('resize', this.binded.onWindowResize, false);

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

    this.widgets[AppWidgetType.TIMELINE] = new WidgetWrapper({
      title: 'Timeline',
      onResize: this.binded.onTimelineResize
    });

    this.widgets[AppWidgetType.LOGS] = new WidgetWrapper({
      title: 'Logs',
      onResize: this.binded.onLogsDataResize
    });

    this.dockPanel.insertTop(this.widgets[AppWidgetType.TIMELINE]);
    this.dockPanel.insertBottom(this.widgets[AppWidgetType.LOGS]);

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

  dispose() {
    window.removeEventListener('resize', this.binded.onWindowResize, false);

    this.toolbar.dispose();
    this.toolbar = null;
    this.timeline.dispose();
    this.timeline = null;
    this.options = null;
  }
}
