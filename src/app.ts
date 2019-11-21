import Split from 'split.js';
import { Toolbar } from './components/toolbar/toolbar';
import throttle from 'lodash/throttle';
import { DataSourceManager } from './model/datasource/manager';
import { SpanGroupingManager } from './model/span-grouping/manager';
import { SpanColoringManager } from './model/span-coloring-manager';
import { SpanLabellingManager } from './model/span-labelling-manager';
import { Trace } from './model/trace';
import { Stage, StageEvent } from './model/stage';
import {
  Timeline,
  TimelineEvent
} from './components/timeline/timeline';
import 'tippy.js/dist/tippy.css';

export interface AppOptions {
  element: HTMLDivElement;
  mainSplit: Split.Instance;
  bodySplit: Split.Instance;
  bottomSplit: Split.Instance;
}

export class App {
  private elements: {
    toolbar: HTMLDivElement;
    bodyLeft: HTMLDivElement;
    bodyRight: HTMLDivElement;
    bottomLeft: HTMLDivElement;
    bottomCenter: HTMLDivElement;
    bottomRight: HTMLDivElement;
  };

  private stage = Stage.getSingleton();
  private toolbar: Toolbar;
  private timeline: Timeline;

  private leftBodySplitSize: number;
  private bottomSplitSize: number;

  readonly throttled = {
    autoResizeTimeline: throttle(this.autoResizeTimeline.bind(this), 100),
    handleMainSplitDrag: throttle(this.handleMainSplitDrag.bind(this), 100),
    handleMainSplitDragEnd: this.handleMainSplitDragEnd.bind(this),
    handleBodySplitDrag: throttle(this.handleBodySplitDrag.bind(this), 100),
    handleBodySplitDragEnd: this.handleBodySplitDragEnd.bind(this),
    handleBottomSplitDrag: throttle(this.handleBottomSplitDrag.bind(this), 100),
    handleBottomSplitDragEnd: this.handleBottomSplitDragEnd.bind(this)
  } as const;

  private binded = {
    onLeftPaneButtonClick: this.onLeftPaneButtonClick.bind(this),
    onBottomPaneButtonClick: this.onBottomPaneButtonClick.bind(this),
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this)
  };

  constructor(private options: AppOptions) {
    // Get dom references of required children components
    const toolbar = document.getElementById('toolbar') as HTMLDivElement;
    const bodyLeft = document.getElementById('body-left') as HTMLDivElement;
    const bodyRight = document.getElementById('body-right') as HTMLDivElement;
    const bottomLeft = document.getElementById('bottom-left') as HTMLDivElement;
    const bottomCenter = document.getElementById(
      'bottom-center'
    ) as HTMLDivElement;
    const bottomRight = document.getElementById(
      'bottom-right'
    ) as HTMLDivElement;

    this.elements = {
      toolbar,
      bodyLeft,
      bodyRight,
      bottomLeft,
      bottomCenter,
      bottomRight
    };

    for (let key in this.elements) {
      const el = this.elements[key];
      if (!el) throw new Error(`Expected child element: #${key}`);
    }

    // Get pane sizes
    this.leftBodySplitSize = this.options.bodySplit.getSizes()[0];
    if (this.leftBodySplitSize < 1) this.leftBodySplitSize = 50;
    this.bottomSplitSize = this.options.mainSplit.getSizes()[1];

    // Create child components
    this.toolbar = new Toolbar({
      element: toolbar,
      onLeftPaneButtonClick: this.binded.onLeftPaneButtonClick,
      onBottomPaneButtonClick: this.binded.onBottomPaneButtonClick
    });
    this.timeline = new Timeline();
  }

  async init() {
    // Init managers related with db
    await Promise.all([
      DataSourceManager.getSingleton().init(),
      SpanGroupingManager.getSingleton().init(),
      SpanColoringManager.getSingleton().init(),
      SpanLabellingManager.getSingleton().init()
    ]);

    // Bind stage event
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);

    // Init timeline
    this.elements.bodyRight.style.overflow = 'hidden'; // Fixes small scrolling
    this.timeline.init(this.elements.bodyRight);
    // TODO: Bind TimelineViewEvent.SPANS_SELECTED
    window.addEventListener('resize', this.throttled.autoResizeTimeline, false);

    await this.toolbar.init(); // Needs dsManager
  }

  //////////////////////////////
  //////// VIEW UPDATES ////////
  //////////////////////////////

  autoResizeTimeline() {
    const { offsetWidth, offsetHeight } = this.elements.bodyRight;
    this.timeline.resize(offsetWidth, offsetHeight);
  }

  ////////////////////////////////
  //////////// EVENTS ////////////
  ////////////////////////////////

  onStageTraceAdded(trace: Trace) {
    this.timeline.addTrace(trace);
  }

  onStageTraceRemoved(trace: Trace) {
    this.timeline.removeTrace(trace);
  }

  private onLeftPaneButtonClick(isExpanded: boolean) {
    if (isExpanded) {
      this.options.bodySplit.setSizes([
        this.leftBodySplitSize,
        100 - this.leftBodySplitSize
      ]);
    } else {
      this.options.bodySplit.collapse(0);
    }
    this.autoResizeTimeline();
  }

  private onBottomPaneButtonClick(isExpanded: boolean) {
    if (isExpanded) {
      this.options.mainSplit.setSizes([
        100 - this.bottomSplitSize,
        this.bottomSplitSize
      ]);
    } else {
      this.options.mainSplit.collapse(1);
    }
    this.autoResizeTimeline();
  }

  private handleMainSplitDrag(sizes: number[]) {
    this.bottomSplitSize = sizes[1];
    this.autoResizeTimeline();
  }

  private handleMainSplitDragEnd(sizes: number[]) {
    this.throttled.handleMainSplitDrag.cancel();
    this.bottomSplitSize = sizes[1];
    // If collapsed
    if (this.bottomSplitSize < 1) {
      this.bottomSplitSize = 25; // Reset the for when it's expanded on toolbar
      this.toolbar.updateBottomPaneExpansion(false);
    }
    this.autoResizeTimeline();
  }

  private handleBodySplitDrag(sizes: number[]) {
    this.leftBodySplitSize = sizes[0];
    this.autoResizeTimeline();
  }

  private handleBodySplitDragEnd(sizes: number[]) {
    this.throttled.handleBodySplitDrag.cancel();
    this.leftBodySplitSize = sizes[0];
    // If collapsed
    if (this.leftBodySplitSize < 1) {
      this.leftBodySplitSize = 50; // Reset the for when it's expanded on toolbar
      this.toolbar.updateLeftPaneExpansion(false);
    }
    this.autoResizeTimeline();
  }

  private handleBottomSplitDrag(sizes: number[]) {
    // TODO
  }

  private handleBottomSplitDragEnd(sizes: number[]) {
    this.throttled.handleBottomSplitDrag.cancel();
  }

  dispose() {
    window.removeEventListener(
      'resize',
      this.throttled.autoResizeTimeline,
      false
    );

    this.toolbar.dispose();
    this.toolbar = null;
    this.timeline.dispose();
    this.timeline = null;
    this.elements = null;
    this.options = null;
  }
}
