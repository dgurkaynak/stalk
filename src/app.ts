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
import { DockPanel } from 'phosphor-dockpanel';
import { WidgetWrapper } from './components/ui/widget-wrapper';

import 'tippy.js/dist/tippy.css';
import './app.css';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  private timeline = new Timeline();

  private dockPanel = new DockPanel();
  private widgets: { [key in keyof typeof AppWidgetType]?: WidgetWrapper } = {};

  private binded = {
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    onWindowResize: this.onWindowResize.bind(this),
    onTimelineResize: this.onTimelineResize.bind(this)
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

    this.toolbar.mount(this.options.element);
    this.initDockPanelAndWidgets();
    await waitUntilOffsetWidthHeightReady(this.widgets[AppWidgetType.TIMELINE].node);
    this.timeline.init(this.widgets[AppWidgetType.TIMELINE].node);
    this.toolbar.init(); // Needs dsManager

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

    this.widgets[AppWidgetType.LOGS] = new WidgetWrapper({ title: 'Logs' });

    this.dockPanel.insertTop(this.widgets[AppWidgetType.TIMELINE]);
    this.dockPanel.insertBottom(this.widgets[AppWidgetType.LOGS]);

    this.dockPanel.attach(this.options.element);
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

  dispose() {
    window.removeEventListener('resize', this.binded.onWindowResize, false);

    this.toolbar.dispose();
    this.toolbar = null;
    this.timeline.dispose();
    this.timeline = null;
    this.options = null;
  }
}

async function waitUntilOffsetWidthHeightReady(el: HTMLElement, retryInterval = 50) {
  const { offsetWidth, offsetHeight } = el;
  if (isNumber(offsetWidth) && isNumber(offsetHeight) && (offsetWidth > 0 || offsetHeight > 0)) {
    return;
  }
  await sleep(retryInterval);
  return waitUntilOffsetWidthHeightReady(el, retryInterval);
}
