import forEach from 'lodash/forEach';
import find from 'lodash/find';
import remove from 'lodash/remove';
import uniq from 'lodash/uniq';
import isString from 'lodash/isString';
import isArray from 'lodash/isArray';
import isFunction from 'lodash/isFunction';
import differenceBy from 'lodash/differenceBy';
import defaults from 'lodash/defaults';
import { SpanGroupView, SpanGroupLayoutType } from './span-group-view';
import Axis from './axis';
import EventEmitter from 'events';
import MouseHandler, { MouseHandlerEvent } from './mouse-handler';
import { SpanView, SpanViewSharedOptions } from './span-view';
import { Trace } from '../../model/trace';
import {
  SpanGrouping,
  SpanGroupingOptions,
} from '../../model/span-grouping/span-grouping';
import processSpanGroupingOptions from '../../model/span-grouping/process';
import {
  TimelineInteractableElementAttribute,
  TimelineInteractableElementType,
  TimelineInteractedElementObject,
} from './interaction';
import {
  SpanColoringOptions,
  operationColoringOptions,
} from '../../model/span-coloring-manager';
import {
  SpanLabellingOptions,
  operationLabellingOptions,
} from '../../model/span-labelling-manager';
import { SpanConnectionDecoration } from './decorations/span-connection';
import IntervalHighlightDecoration from './decorations/interval-highlight';
import { formatMicroseconds } from '../../utils/format-microseconds';
import SelectionView from './selection-view';
import { SpanTooltipContent } from '../span-tooltip/span-tooltip-content';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { Span } from '../../model/interfaces';
import VerticalLineDecoration from './decorations/vertical-line';
import {
  ContextMenuManager,
  ContextMenuEvent,
} from '../ui/context-menu/context-menu-manager';
import { clipboard } from 'electron';

const SVG_NS = 'http://www.w3.org/2000/svg';

export enum TimelineViewEvent {
  SPAN_SELECTED = 'tve_span_selected',
}

export enum TimelineTool {
  MOVE = 'move',
  RULER = 'ruler',
}

export interface TimelineViewStyle {
  timeRulerHeight: number;
  timeRulerTickLength: number; // in px
  timeRulerTickLineColor: string;
  timeRulerTickTextOffsetTop: number;
  timeRulerTickTextColor: string;
  timeRulerTickTextSize: number;
  initialSpanMarginToViewport: number;
}

export interface TimelineViewComputedStyles extends TimelineViewStyle {
  width: number; // svg width
  height: number; // svg height
  contentHeight: number; // in px
  panelTranslateY: number;
}

export class TimelineView extends EventEmitter {
  private svg = document.createElementNS(SVG_NS, 'svg');
  private defs = document.createElementNS(SVG_NS, 'defs');

  private tickContainer = document.createElementNS(SVG_NS, 'g');
  private tickElements: { text: SVGTextElement; line: SVGLineElement }[] = [];

  private bodyContainer = document.createElementNS(SVG_NS, 'g');
  private bodyClipPath = document.createElementNS(SVG_NS, 'clipPath');
  private bodyClipPathRect = document.createElementNS(SVG_NS, 'rect');

  private groupNamePanel = document.createElementNS(SVG_NS, 'g');
  private timelinePanel = document.createElementNS(SVG_NS, 'g');

  readonly decorationUnderlayPanel = document.createElementNS(SVG_NS, 'g');
  readonly decorationOverlayPanel = document.createElementNS(SVG_NS, 'g');
  readonly decorations = {
    logVerticalLine: new VerticalLineDecoration(this),
    selectedSpanIntervalHighlight: new IntervalHighlightDecoration(this),
    selectedSpanConnections: [] as SpanConnectionDecoration[],
    hoveredSpanConnections: [] as SpanConnectionDecoration[],
  };

  readonly mouseHandler = new MouseHandler(this.svg);
  readonly axis = ((window as any).axis = new Axis([0, 0], [0, 0]));

  private traces: Trace[] = [];
  private spanGrouping: SpanGrouping;
  private groupViews: SpanGroupView[] = [];

  private groupLayoutMode = SpanGroupLayoutType.COMPACT; // Do not forget to change related config in timeline-wrapper
  private readonly spanViewSharedOptions: SpanViewSharedOptions = {
    axis: this.axis,
    colorFor: operationColoringOptions.colorBy, // Do not forget to change related config in timeline-wrapper
    labelFor: operationLabellingOptions.labelBy, // Do not forget to change related config in timeline-wrapper
  };

  private hoveredElements: TimelineInteractedElementObject[] = [];
  private selectedSpanId: string;

  private selectionView = new SelectionView({
    parent: this.svg,
    axis: this.axis,
  });

  private _tool = TimelineTool.MOVE;

  private spanTooltipTippy: TippyInstance;
  private spanTooltipContent = new SpanTooltipContent({
    axis: this.axis,
  });
  private spanTooltipStuffCache = {
    svgBBTop: 0,
    idleMouseClientX: 0,
  };

  private contextMenuManager = ContextMenuManager.getSingleton();

  private readonly computedStyles: TimelineViewComputedStyles;

  private binded = {
    onMouseIdleMove: this.onMouseIdleMove.bind(this),
    onMouseIdleLeave: this.onMouseIdleLeave.bind(this),
    onMousePanStart: this.onMousePanStart.bind(this),
    onMousePanMove: this.onMousePanMove.bind(this),
    onMousePanEnd: this.onMousePanEnd.bind(this),
    onWheel: this.onWheel.bind(this),
    onClick: this.onClick.bind(this),
  };

  constructor(options?: { style?: Partial<TimelineViewStyle> }) {
    super();

    const style = defaults(options?.style, {
      timeRulerHeight: 20,
      timeRulerTickLength: 200,
      timeRulerTickLineColor: '#eee',
      timeRulerTickTextOffsetTop: 14,
      timeRulerTickTextColor: '#999',
      timeRulerTickTextSize: 10,
      initialSpanMarginToViewport: 5,
    } as TimelineViewStyle);
    this.computedStyles = {
      ...style,
      width: 0,
      height: 0,
      contentHeight: 0,
      panelTranslateY: 0,
    };

    this.svg.setAttributeNS(
      'http://www.w3.org/2000/xmlns/',
      'xmlns:xlink',
      'http://www.w3.org/1999/xlink'
    );
    this.svg.classList.add('timeline-svg');

    this.svg.appendChild(this.defs);

    const tooltipShadowFilter = document.createElementNS(SVG_NS, 'filter');
    tooltipShadowFilter.id = 'tooltip-shadow';
    tooltipShadowFilter.setAttribute('x', '-50%');
    tooltipShadowFilter.setAttribute('y', '-50%');
    tooltipShadowFilter.setAttribute('width', '200%');
    tooltipShadowFilter.setAttribute('height', '200%');
    tooltipShadowFilter.innerHTML = `<feDropShadow stdDeviation="3 3" in="SourceGraphic" dx="0" dy="5" flood-color="#1F3646" flood-opacity="0.5" result="dropShadow"/>`;
    this.defs.appendChild(tooltipShadowFilter);

    const arrowMarker = document.createElementNS(SVG_NS, 'marker');
    arrowMarker.id = 'arrow-head';
    arrowMarker.setAttribute('viewBox', '0 0 10 10');
    arrowMarker.setAttribute('refX', '5');
    arrowMarker.setAttribute('refY', '5');
    arrowMarker.setAttribute('markerWidth', '6');
    arrowMarker.setAttribute('markerHeight', '6');
    arrowMarker.setAttribute('orient', 'auto-start-reverse');
    arrowMarker.innerHTML = `<path d="M 0 0 L 10 5 L 0 10 z" />`;
    this.defs.appendChild(arrowMarker);

    // Set-up grouping
    this.spanGrouping = new SpanGrouping(processSpanGroupingOptions); // Do not forget to change related config in timeline-wrapper
  }

  init(options: { width: number; height: number }) {
    let width = options?.width;
    let height = options?.height;
    if (!width || !height) {
      throw new Error('Missing timeline dimensions');
    }
    this.resize(width, height);
    this.setupPanels();
    this.mouseHandler.init();

    // Bind events
    this.mouseHandler.on(
      MouseHandlerEvent.IDLE_MOVE,
      this.binded.onMouseIdleMove
    );
    this.mouseHandler.on(
      MouseHandlerEvent.IDLE_LEAVE,
      this.binded.onMouseIdleLeave
    );
    this.mouseHandler.on(
      MouseHandlerEvent.PAN_START,
      this.binded.onMousePanStart
    );
    this.mouseHandler.on(
      MouseHandlerEvent.PAN_MOVE,
      this.binded.onMousePanMove
    );
    this.mouseHandler.on(MouseHandlerEvent.PAN_END, this.binded.onMousePanEnd);
    this.mouseHandler.on(MouseHandlerEvent.WHEEL, this.binded.onWheel);
    this.mouseHandler.on(MouseHandlerEvent.CLICK, this.binded.onClick);

    this.spanTooltipTippy = tippy(document.body, {
      lazy: false,
      duration: 0,
      updateDuration: 0,
      trigger: 'custom',
      arrow: true,
      content: this.spanTooltipContent.element,
      multiple: true,
      placement: 'top',
      theme: 'span-tooltip',
      onCreate(instance) {
        instance.popperInstance.reference = {
          clientWidth: 0,
          clientHeight: 0,
          getBoundingClientRect() {
            return {
              width: 0,
              height: 0,
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            };
          },
        };
      },
    });
    // this.spanTooltipTippy.hide = () => {};
  }

  mount(parentElement: HTMLDivElement) {
    parentElement.appendChild(this.svg);
  }

  unmount() {
    this.svg.parentElement?.removeChild(this.svg);
  }

  resize(width: number, height: number) {
    this.computedStyles.width = width;
    this.computedStyles.height = height;
    const {
      timeRulerHeight,
      initialSpanMarginToViewport,
    } = this.computedStyles;

    this.svg.setAttribute('width', `${width}`);
    this.svg.setAttribute('height', `${height}`);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    this.bodyClipPathRect.setAttribute('width', `${width}`);
    this.bodyClipPathRect.setAttribute('height', `${height - timeRulerHeight}`);

    this.axis.updateOutputRange([
      initialSpanMarginToViewport,
      width - initialSpanMarginToViewport,
    ]);

    this.groupViews.forEach((g) => g.handleAxisUpdate());
    this.updateAllDecorations();
    this.updateTicks();

    this.groupViews.forEach((v) => v.updateSeperatorLineWidths(width));
    this.keepPanelTraslateYInScreen();

    const svgRect = this.svg.getBoundingClientRect();
    this.spanTooltipStuffCache.svgBBTop = svgRect.top;
  }

  updateAllDecorations(forceReprepare = false) {
    for (const decoration of Object.values(this.decorations)) {
      const decorations = isArray(decoration) ? decoration : [decoration];

      if (forceReprepare) {
        for (const d of decorations) {
          const rv = d.prepare({} as any) as any;
          if (rv === false) d.unmount();
        }
      }

      for (const d of decorations) {
        d.update();
      }
    }
  }

  setupPanels() {
    const { width, height, timeRulerHeight } = this.computedStyles;

    this.bodyClipPath.id = 'body-clip-path';
    this.bodyClipPathRect.setAttribute('x', `0`);
    this.bodyClipPathRect.setAttribute('y', `0`);
    this.bodyClipPathRect.setAttribute('width', `${width}`);
    this.bodyClipPathRect.setAttribute('height', `${height - timeRulerHeight}`);
    this.bodyClipPath.appendChild(this.bodyClipPathRect);
    this.defs.appendChild(this.bodyClipPath);

    this.svg.appendChild(this.tickContainer);

    this.bodyContainer.setAttribute('x', `0`);
    this.bodyContainer.setAttribute('y', `0`);
    this.bodyContainer.setAttribute(
      'transform',
      `translate(0, ${timeRulerHeight})`
    );
    this.bodyContainer.setAttribute('clip-path', 'url(#body-clip-path)');
    this.bodyContainer.appendChild(this.decorationUnderlayPanel);
    this.bodyContainer.appendChild(this.groupNamePanel);
    this.bodyContainer.appendChild(this.timelinePanel);
    this.bodyContainer.appendChild(this.decorationOverlayPanel);
    this.svg.appendChild(this.bodyContainer);
  }

  getSpanTooltipContent() {
    return this.spanTooltipContent;
  }

  // Array order is from deepest element to root
  getInteractedElementsFromMouseEvent(
    e: MouseEvent
  ): TimelineInteractedElementObject[] {
    let element = e.target as SVGElement | null;
    const matches: TimelineInteractedElementObject[] = [];

    while (element && element !== this.svg) {
      if (element.hasAttribute(TimelineInteractableElementAttribute)) {
        matches.push({
          type: element.getAttribute(
            TimelineInteractableElementAttribute
          )! as any,
          element: element,
        });
      }
      element = (element.parentElement as unknown) as SVGElement;
    }

    return matches;
  }

  dispose() {
    this.mouseHandler.removeListener(
      MouseHandlerEvent.IDLE_MOVE,
      this.binded.onMouseIdleMove
    );
    this.mouseHandler.removeListener(
      MouseHandlerEvent.IDLE_LEAVE,
      this.binded.onMouseIdleLeave
    );
    this.mouseHandler.removeListener(
      MouseHandlerEvent.PAN_START,
      this.binded.onMousePanStart
    );
    this.mouseHandler.removeListener(
      MouseHandlerEvent.PAN_MOVE,
      this.binded.onMousePanMove
    );
    this.mouseHandler.removeListener(
      MouseHandlerEvent.WHEEL,
      this.binded.onWheel
    );
    this.mouseHandler.removeListener(
      MouseHandlerEvent.CLICK,
      this.binded.onClick
    );

    this.mouseHandler.dispose();

    this.removeAllListeners();
  }

  updateGroupLayoutMode(groupLayoutType: SpanGroupLayoutType) {
    this.groupLayoutMode = groupLayoutType;
    this.groupViews.forEach((g) => {
      g.setLayoutType(groupLayoutType);
      g.layout();
    });
    this.updateGroupVerticalPositions();
    this.updateAllDecorations();
    this.keepPanelTraslateYInScreen();
  }

  // can throw
  // - this.spanGrouping.addSpan
  // - this.layout
  updateSpanGrouping(spanGroupingOptions: SpanGroupingOptions) {
    // TODO: Dispose previous grouping maybe?
    this.spanGrouping = new SpanGrouping(spanGroupingOptions);
    this.traces.forEach((t) =>
      t.spans.forEach((s) => this.spanGrouping.addSpan(s, t))
    );
    this.layout();
  }

  // can throw
  // - s.updateColors
  updateSpanColoring(options: SpanColoringOptions) {
    this.spanViewSharedOptions.colorFor = options.colorBy;
    this.groupViews.forEach((g) => {
      g.setSpanViewSharedOptions(this.spanViewSharedOptions);
      g.getAllSpanViews().forEach((s) => s.updateColors());
    });
  }

  // can throw
  // - s.updateLabelText
  updateSpanLabelling(options: SpanLabellingOptions) {
    this.spanViewSharedOptions.labelFor = options.labelBy;
    this.groupViews.forEach((g) => {
      g.setSpanViewSharedOptions(this.spanViewSharedOptions);
      g.getAllSpanViews().forEach((s) => s.updateLabelText());
    });
  }

  get tool() {
    return this._tool;
  }

  updateTool(tool: TimelineTool) {
    this._tool = tool;
  }

  getTraces() {
    return this.traces;
  }

  // can throw
  // - this.spanGrouping.addSpan
  // - this.layout
  addTrace(trace: Trace) {
    const idMatch = find(this.traces, (t) => t.id === trace.id);
    if (idMatch) {
      return false;
    }

    this.traces.push(trace);
    trace.spans.forEach((s) => this.spanGrouping.addSpan(s, trace));

    this.layout();
    return true;
  }

  // can throw
  // - this.layout
  removeTrace(trace: Trace) {
    const removeds = remove(this.traces, (t) => t.id === trace.id);
    if (removeds.length === 0) {
      return false;
    }

    let isSelectedSpanRemoved = false;
    trace.spans.forEach((s) => {
      this.spanGrouping.removeSpan(s);
      if (this.selectedSpanId && s.id == this.selectedSpanId) {
        isSelectedSpanRemoved = true;
      }
    });

    this.layout();
    if (isSelectedSpanRemoved) {
      this.selectSpan(null, true);
    }
    return true;
  }

  findGroupView(
    groupId: string | ((groupView: SpanGroupView) => boolean)
  ): SpanGroupView | undefined {
    if (isString(groupId)) {
      return find(this.groupViews, (g) => g.spanGroup.id === groupId);
    } else if (isFunction(groupId)) {
      return find(this.groupViews, groupId);
    } else {
      throw new Error('Unsupported argument type');
    }
  }

  findSpanView(
    spanId: string | ((spanView: SpanView) => boolean)
  ): [SpanGroupView | undefined, SpanView | undefined] {
    if (isString(spanId)) {
      const groupView = find(
        this.groupViews,
        (g) => !!g.getSpanViewById(spanId)
      );
      return [groupView, groupView?.getSpanViewById(spanId)];
    } else if (isFunction(spanId)) {
      for (let groupView of this.groupViews) {
        const spanViews = groupView.getAllSpanViews();
        const spanView = find(spanViews, spanId);
        if (spanView) {
          return [groupView, spanView];
        }
      }
      return [undefined, undefined];
    } else {
      throw new Error('Unsupported argument type');
    }
  }

  findSpanViews(
    predicate: (spanView: SpanView) => boolean
  ): [SpanGroupView, SpanView][] {
    const acc: [SpanGroupView, SpanView][] = [];
    for (let groupView of this.groupViews) {
      const spanViews = groupView.getAllSpanViews();
      spanViews.filter(predicate).forEach((spanView) => {
        acc.push([groupView, spanView]);
      });
    }
    return acc;
  }

  // can throw
  // - groupView.init
  layout() {
    let startTimestamp = Infinity;
    let finishTimestamp = -Infinity;
    this.traces.forEach((trace) => {
      startTimestamp = Math.min(startTimestamp, trace.startTime);
      finishTimestamp = Math.max(finishTimestamp, trace.finishTime);
    });

    const { width, initialSpanMarginToViewport } = this.computedStyles;

    this.axis.reset(
      [startTimestamp, finishTimestamp],
      [initialSpanMarginToViewport, width - initialSpanMarginToViewport]
    );

    this.groupViews.forEach((v) => v.dispose());
    this.groupViews = [];

    const groups = this.spanGrouping
      .getAllGroups()
      .sort((a, b) => a.startTimestamp - b.startTimestamp);
    const groupNameCounter: { [key: string]: number } = {};
    groups.forEach((group) => {
      let groupLabel = group.name;
      if (!groupNameCounter[group.name]) groupNameCounter[group.name] = 0;
      groupNameCounter[group.name]++;
      if (groupNameCounter[group.name] > 1) {
        groupLabel = `${group.name} ${groupNameCounter[group.name]}`;
      }

      const groupView = new SpanGroupView({
        group,
        layoutType: this.groupLayoutMode,
        label: groupLabel,
      });
      groupView.init({
        groupNamePanel: this.groupNamePanel,
        timelinePanel: this.timelinePanel,
        svgDefs: this.defs,
        spanViewSharedOptions: this.spanViewSharedOptions,
      });
      groupView.updateSeperatorLineWidths(width);
      groupView.layout();

      this.groupViews.push(groupView);
    });

    // TODO: Check if selected span id is still existing, if it doesn't remove it from selecteds,
    // Re-select the previous ones

    this.updateGroupVerticalPositions();

    // Annotations
    this.updateAllDecorations(true); // Force re-prepare because all the groupViews and spanViews are replaced w/ new
    this.updateTicks();

    // Reset vertical panning
    this.setPanelTranslateY(0);
  }

  updateGroupVerticalPositions() {
    let y = 0;

    this.groupViews.forEach((groupView, i) => {
      groupView.updatePosition({ y });
      y += groupView.getComputedStyles().height;
    });

    this.computedStyles.contentHeight = y;
  }

  translateX(delta: number) {
    this.axis.translate(delta);
    this.groupViews.forEach((g) => g.handleAxisTranslate());
    this.updateAllDecorations();
    this.updateTicks();
  }

  translateY(delta: number) {
    const {
      height,
      contentHeight,
      panelTranslateY,
      timeRulerHeight,
    } = this.computedStyles;
    const bodyHeight = height - timeRulerHeight;
    if (contentHeight <= bodyHeight) return;

    const newTranslateY = panelTranslateY + delta;
    const newPanelTranslateY = Math.min(
      Math.max(newTranslateY, bodyHeight - contentHeight),
      0
    );
    this.setPanelTranslateY(newPanelTranslateY);
  }

  setPanelTranslateY(y: number) {
    this.computedStyles.panelTranslateY = y;
    this.groupNamePanel.setAttribute('transform', `translate(0, ${y})`);
    this.timelinePanel.setAttribute('transform', `translate(0, ${y})`);
    this.decorationUnderlayPanel.setAttribute(
      'transform',
      `translate(0, ${y})`
    );
    this.decorationOverlayPanel.setAttribute('transform', `translate(0, ${y})`);
  }

  getComputedStyles() {
    return this.computedStyles;
  }

  private keepPanelTraslateYInScreen() {
    const {
      height,
      panelTranslateY,
      contentHeight,
      timeRulerHeight,
    } = this.computedStyles;
    const bodyHeight = height - timeRulerHeight;
    const bottomY = panelTranslateY + contentHeight;
    const offsetSnapToBottom = bodyHeight - bottomY;
    if (offsetSnapToBottom <= 0) return;
    const newTranslateY = Math.min(panelTranslateY + offsetSnapToBottom, 0); // Can be max 0
    this.setPanelTranslateY(newTranslateY);
  }

  zoom(scaleFactor: number, anchorPosX: number) {
    this.axis.zoom(scaleFactor, anchorPosX);
    this.groupViews.forEach((g) => g.handleAxisZoom());
    this.updateAllDecorations();
    this.updateTicks();
  }

  selectSpan(spanId: string, silent = false) {
    // If a span is already selected, update its style
    if (this.selectedSpanId) {
      const previousSelectedSpanView = this.findSpanView(
        this.selectedSpanId
      )[1];
      if (previousSelectedSpanView) {
        previousSelectedSpanView.updateColorStyle('normal');
        previousSelectedSpanView.hideLogs();
      }
    }

    // Unmount all the selected spans connections
    this.decorations.selectedSpanIntervalHighlight.unmount();
    this.decorations.selectedSpanConnections.forEach((c) => c.unmount());
    this.decorations.hoveredSpanConnections.forEach((c) => c.unmount());

    this.selectedSpanId = spanId;
    // If new span exists
    const [groupView, spanView] = spanId
      ? this.findSpanView(spanId)
      : [null, null];
    if (spanId && spanView && groupView) {
      spanView.updateColorStyle('selected');
      spanView.showLogs();
      groupView.bringSpanViewToTop(spanId);
      this.showSelectedSpanConnections(this.selectedSpanId);

      this.decorations.selectedSpanIntervalHighlight.prepare({
        startTimestamp: spanView.span.startTime,
        finishTimestamp: spanView.span.finishTime,
        lineColor: 'rgba(62, 124, 214, 0.25)',
        lineWidth: 1,
        lineDashArray: '2',
        fillColor: 'rgba(58, 122, 217, 0.05)',
      });
      this.decorations.selectedSpanIntervalHighlight.update();
      this.decorations.selectedSpanIntervalHighlight.mount();
    }

    if (!silent) {
      this.emit(TimelineViewEvent.SPAN_SELECTED, this.selectedSpanId);
    }
  }

  getSelectedSpanId() {
    return this.selectedSpanId;
  }

  focusSpans(spanIds: string[]) {
    if (!spanIds || spanIds.length == 0) return;
    if (this.traces.length == 0) return;

    spanIds = uniq(spanIds);

    let minStartTime = Infinity;
    let maxFinishTime = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    spanIds.forEach((spanId) => {
      const [groupView, spanView] = this.findSpanView(spanId);
      if (!groupView || !spanView) return;
      const span = spanView.span;

      minStartTime = Math.min(minStartTime, span.startTime);
      maxFinishTime = Math.max(maxFinishTime, span.finishTime);

      const spanStyles = spanView.getComputedStyles();
      const yTop = groupView.getComputedStyles().y + spanStyles.y;
      const yBottom = yTop + spanStyles.rowHeight;
      minY = Math.min(minY, yTop);
      maxY = Math.max(maxY, yBottom);
    });

    if (
      !isFinite(minStartTime) ||
      !isFinite(maxFinishTime) ||
      !isFinite(minY) ||
      !isFinite(maxY)
    ) {
      return;
    }

    const {
      width,
      height,
      contentHeight,
      timeRulerHeight,
    } = this.computedStyles;

    this.axis.focus(
      [minStartTime, maxFinishTime],
      [width / 4, (width * 3) / 4]
    );
    // Copied from .zoom() method
    this.groupViews.forEach((g) => g.handleAxisZoom());
    this.updateAllDecorations();
    this.updateTicks();

    // Handle translate y
    const bodyHeight = height - timeRulerHeight; // viewport height
    // if content is already smaller than viewport, noop
    if (contentHeight > bodyHeight) {
      const newTranslateY = -((minY + maxY) / 2) + bodyHeight / 2;
      const panelTranslateY = Math.min(
        Math.max(newTranslateY, bodyHeight - contentHeight),
        0
      );
      this.setPanelTranslateY(panelTranslateY);
    }
  }

  // Changes just the translation, not zoom factor
  translateToSpanIfNotInViewport(spanId: string) {
    const [groupView, spanView] = this.findSpanView(spanId);
    if (!groupView || !spanView) return;
    const span = spanView.span;
    const spanStyles = spanView.getComputedStyles();
    const spanYTop = groupView.getComputedStyles().y + spanStyles.y;
    const spanYBottom = spanYTop + spanStyles.rowHeight;

    const {
      height,
      contentHeight,
      panelTranslateY,
      timeRulerHeight,
    } = this.computedStyles;

    // Handle translate y
    const bodyHeight = height - timeRulerHeight; // viewport height
    // if content is already smaller than viewport, noop
    if (contentHeight > bodyHeight) {
      const viewportTopY = -panelTranslateY;
      const viewportBottomY = -panelTranslateY + bodyHeight;

      if (spanYBottom > viewportBottomY) {
        const newTranslateY = panelTranslateY - (spanYBottom - viewportBottomY);
        this.setPanelTranslateY(newTranslateY);
      } else if (spanYTop < viewportTopY) {
        const newTranslateY = panelTranslateY + (viewportTopY - spanYTop + 10);
        this.setPanelTranslateY(newTranslateY);
      } else {
        // in viewport, noop
      }
    }

    // Handle translate x
    const spanXLeft = this.axis.input2output(span.startTime);
    const spanXRight = this.axis.input2output(span.finishTime);
    const [viewportLeftX, viewportRightX] = this.axis.getOutputRange();
    if (spanXRight < viewportLeftX) {
      const delta = viewportLeftX - spanXRight + 50;
      this.translateX(delta);
    } else if (spanXLeft > viewportRightX) {
      const delta = viewportRightX - spanXLeft - 50;
      this.translateX(delta);
    } else {
      // in viewport, noop
    }
  }

  showLogVerticalLine(timestamp: number) {
    this.decorations.logVerticalLine.prepare({
      timestamp,
      lineColor: 'rgba(0, 0, 0, 0.75)',
      lineWidth: 1,
      position: 'overlay',
      displayTime: false,
    });
    this.decorations.logVerticalLine.update();
    this.decorations.logVerticalLine.mount();
  }

  hideLogVerticalLine() {
    this.decorations.logVerticalLine.unmount();
  }

  ////////////////////////////////////////
  //////////// EVENT-HANDLING ////////////
  ////////////////////////////////////////

  onMouseIdleMove(e: MouseEvent) {
    if (this.traces.length === 0) return;

    // If context menu is dislaying, prevent span tooltip
    if (this.contextMenuManager.isShowing) return;

    // We want to update immdieadely span tooltip
    this.spanTooltipContent.updateMousePos(e.offsetX, e.offsetY);

    // When we're hacking tippy.js to show it custom coordinates.
    // We're overriding it's element reference when a span is mouse-entered (line 769)
    // When user is mouse-moving on span, we want to follow mouse coordinate
    // That's why we update coordinate cache and popper instance
    this.spanTooltipStuffCache.idleMouseClientX = e.clientX;
    this.spanTooltipTippy.popperInstance.update();

    // TODO: Maybe debounce below?
    const matches = this.getInteractedElementsFromMouseEvent(e);

    const previousHoveredElements = this.hoveredElements;
    this.hoveredElements = matches;

    const removed = differenceBy(
      previousHoveredElements,
      matches,
      ({ element }) => element
    );
    const added = differenceBy(
      matches,
      previousHoveredElements,
      ({ element }) => element
    );

    removed.forEach(({ type, element }) => {
      switch (type) {
        case TimelineInteractableElementType.SPAN_VIEW_CONTAINER: {
          const { id: spanId } = SpanView.getPropsFromContainer(element);
          if (!spanId) return;
          this.spanTooltipTippy.hide();
          if (this.selectedSpanId == spanId) return;
          const spanView = this.findSpanView(spanId)[1];
          if (!spanView) return;
          spanView.updateColorStyle('normal');
          spanView.hideLogs();
          this.decorations.hoveredSpanConnections.forEach((d) => d.unmount());
          return;
        }

        case TimelineInteractableElementType.SPAN_CONNECTION: {
          const {
            id: spanConnectionId,
          } = SpanConnectionDecoration.getPropsFromPathElement(element);
          if (!spanConnectionId) return;
          const spanConnection = find(
            this.decorations.selectedSpanConnections,
            (d) => d.id == spanConnectionId
          );
          if (!spanConnection) return;
          spanConnection.updateStyle('normal');
          return;
        }
      }
    });

    added.forEach(({ type, element }) => {
      switch (type) {
        case TimelineInteractableElementType.SPAN_VIEW_CONTAINER: {
          const { id: spanId } = SpanView.getPropsFromContainer(element);
          if (!spanId) return;
          const [groupView, spanView] = this.findSpanView(spanId);

          if (spanView) {
            // Show span tooltip, even if it's selected!
            this.spanTooltipContent.updateSpan(spanView);
            // HACK ALERT: To show tippy.js at custom coordinates
            Object.assign(this.spanTooltipTippy.popperInstance.reference, {
              clientWidth: 0,
              clientHeight: 0,
              getBoundingClientRect: () => {
                const {
                  panelTranslateY,
                  timeRulerHeight,
                } = this.computedStyles;
                const spanViewProp = spanView.getComputedStyles();
                const groupViewProp = groupView.getComputedStyles();
                const top =
                  this.spanTooltipStuffCache.svgBBTop +
                  spanViewProp.y +
                  groupViewProp.y +
                  groupViewProp.spansContainerMarginTop +
                  timeRulerHeight +
                  panelTranslateY;
                return {
                  width: 0,
                  height: spanViewProp.barHeight,
                  top: top,
                  bottom: top + spanViewProp.barHeight,
                  left: this.spanTooltipStuffCache.idleMouseClientX,
                  right: this.spanTooltipStuffCache.idleMouseClientX,
                };
              },
            });
            this.spanTooltipTippy.popperInstance.update();
            this.spanTooltipTippy.show();
          }

          // If it's already selected, early terminate
          // Because we don't want to update span style or show span connection
          // It's already showing by selection logic
          if (this.selectedSpanId == spanId) return;
          if (!spanView) return;
          spanView.updateColorStyle('hover');
          spanView.showLogs();
          this.showHoveredSpanConnections(spanId);

          return;
        }

        case TimelineInteractableElementType.SPAN_CONNECTION: {
          // If there is no span selected, no hover
          if (!this.selectedSpanId) return;
          const {
            id: spanConnectionId,
            fromSpanId,
            toSpanId,
          } = SpanConnectionDecoration.getPropsFromPathElement(element);
          if (!spanConnectionId) return;

          // If span connection is nothing to do with current selected span, no hover
          if (
            this.selectedSpanId != fromSpanId &&
            this.selectedSpanId != toSpanId
          ) {
            return;
          }

          const spanConnection = find(
            this.decorations.selectedSpanConnections,
            (d) => d.id == spanConnectionId
          );
          if (!spanConnection) return;
          spanConnection.updateStyle('hover');
          return;
        }
      }
    });

    if (removed.length === 0 && added.length === 0) return;
  }

  onMouseIdleLeave(e: MouseEvent) {
    this.decorations.hoveredSpanConnections.forEach((d) => d.unmount());
    this.spanTooltipTippy.hide();
  }

  onMousePanStart(e: MouseEvent) {
    this.spanTooltipTippy.hide();
    this.selectionView.unmount();

    if (this.traces.length === 0) return;

    if (this._tool == TimelineTool.RULER) {
      this.selectionView.start(e.offsetX, e.offsetY);
      this.selectionView.update(e.offsetX, e.offsetY);
      this.selectionView.mount();
    }
  }

  onMousePanMove(e: MouseEvent) {
    if (this.traces.length === 0) return;

    if (this._tool == TimelineTool.RULER) {
      this.selectionView.update(e.offsetX, e.offsetY);
    } else {
      // Translate
      this.translateX(e.movementX);
      this.translateY(e.movementY);
    }
  }

  onMousePanEnd(e: MouseEvent) {
    if (this.traces.length === 0) return;

    const isMouseLeaveBeforeUp = e.type == 'mouseleave';
    this.selectionView.unmount();

    if (this._tool == TimelineTool.RULER && !isMouseLeaveBeforeUp) {
      // TODO: e.offsetX, e.offsetY are way wrong, fix it in MouseHandler;
      const rect = this.selectionView.stop();
    }
  }

  onWheel(e: WheelEvent) {
    if (this.traces.length === 0) return;
    this.spanTooltipTippy.popperInstance.update();
    this.zoom(1 - 0.01 * e.deltaY, e.offsetX);
  }

  onClick(e: MouseEvent) {
    this.spanTooltipTippy.hide();

    if (!e) return; // Sometimes event can be garbage-collected

    // Get interacted element
    const matches = this.getInteractedElementsFromMouseEvent(e);

    let clickedSpanId: string | null = null;
    let clickedGroupLabelId: string | null = null;
    let clickedSpanConnectionTargetSpanId: string | null = null;

    forEach(matches, ({ type, element }) => {
      switch (type) {
        case TimelineInteractableElementType.SPAN_VIEW_CONTAINER: {
          const { id: spanId } = SpanView.getPropsFromContainer(element);
          if (!spanId) return;
          clickedSpanId = spanId;
          return;
        }

        case TimelineInteractableElementType.GROUP_VIEW_LABEL_TEXT: {
          const { id: groupId } = SpanGroupView.getPropsFromLabelText(element);
          if (!groupId) return;
          clickedGroupLabelId = groupId;
          return;
        }

        case TimelineInteractableElementType.SPAN_CONNECTION: {
          // If there is no span selected, no click
          if (!this.selectedSpanId) return;
          const {
            id: spanConnectionId,
            fromSpanId,
            toSpanId,
          } = SpanConnectionDecoration.getPropsFromPathElement(element);
          if (!spanConnectionId) return;

          // If span connection is nothing to do with current selected span, no click
          if (
            this.selectedSpanId != fromSpanId &&
            this.selectedSpanId != toSpanId
          ) {
            return;
          }

          clickedSpanConnectionTargetSpanId =
            fromSpanId == this.selectedSpanId ? toSpanId : fromSpanId;
          return;
        }
      }
    });

    // If left button clicked
    if (e.button == 0) {
      const groupView =
        clickedGroupLabelId && this.findGroupView(clickedGroupLabelId);
      if (clickedGroupLabelId && groupView) {
        const isVisible = groupView.toggleView();
        this.updateGroupVerticalPositions();
        this.keepPanelTraslateYInScreen();
        this.updateAllDecorations();

        return; // Early terminate so that selection does not lost
      }

      if (clickedSpanConnectionTargetSpanId) {
        this.selectSpan(clickedSpanConnectionTargetSpanId);
        this.translateToSpanIfNotInViewport(clickedSpanConnectionTargetSpanId);
        return; // Early terminate so that selection does not lost
      }

      // Select clicked span, or nothing (deselectes all of them)
      this.selectSpan(clickedSpanId);
      return;
    }

    // If right button click
    if (e.button == 2) {
      // If clicked on a span, show context menu
      if (clickedSpanId) {
        this.contextMenuManager.show({
          x: e.clientX,
          y: e.clientY,
          menuItems: [
            {
              selectItem: {
                type: 'item',
                text: 'Show in Table View',
                id: 'showInTableView',
              },
              emitEvent: {
                event: ContextMenuEvent.SHOW_SPAN_IN_TABLE_VIEW,
                data: clickedSpanId,
              },
            },
            {
              selectItem: {
                type: 'item',
                text: 'Focus',
                altText: 'F',
                id: 'focus',
              },
              onSelected: () => this.focusSpans([clickedSpanId]),
            },
            {
              selectItem: {
                type: 'item',
                text: 'Copy Span To Clipboard',
                id: 'copyToClipboard',
                altText: '⌘C',
              },
              onSelected: () => this.copySpanToClipboard(clickedSpanId),
            },
          ],
        });
        return;
      }

      return;
    }
  }

  private copySpanToClipboard(spanId: string) {
    if (!spanId) return;
    const [groupView, spanView] = this.findSpanView(spanId);
    if (!spanView) return;
    clipboard.writeText(JSON.stringify(spanView.span, null, 4));
  }

  ///////////////////////////////////////
  //////////// TICK HANDLING ////////////
  ///////////////////////////////////////

  updateTicks() {
    if (this.traces.length == 0) {
      this.tickElements.forEach(({ text, line }) => {
        text.parentElement?.removeChild(text);
        line.parentElement?.removeChild(line);
      });
      return;
    }

    const {
      width,
      height,
      timeRulerTickLength,
      timeRulerTickLineColor,
      timeRulerTickTextOffsetTop,
      timeRulerTickTextColor,
      timeRulerTickTextSize,
    } = this.computedStyles;
    const tickCount = Math.round(width / timeRulerTickLength);
    const ticks = this.axis.ticks(tickCount);

    ticks.forEach((tick, i) => {
      if (!this.tickElements[i]) {
        this.tickElements[i] = {
          line: document.createElementNS(SVG_NS, 'line'),
          text: document.createElementNS(SVG_NS, 'text'),
        };
      }

      const { line, text } = this.tickElements[i];

      line.setAttribute('x1', tick.output + '');
      line.setAttribute('x2', tick.output + '');
      line.setAttribute('y1', '0');
      line.setAttribute('y2', height + '');
      line.setAttribute('stroke', timeRulerTickLineColor);
      line.setAttribute('stroke-width', '1');
      this.tickContainer.appendChild(line);

      text.textContent = formatMicroseconds(tick.inputRelative);
      text.setAttribute('x', tick.output - 4 + '');
      text.setAttribute('y', timeRulerTickTextOffsetTop + '');
      text.setAttribute('fill', timeRulerTickTextColor);
      text.setAttribute('font-size', timeRulerTickTextSize + '');
      text.setAttribute('text-anchor', 'end');
      this.tickContainer.appendChild(text);
    });

    // Remove unused ones
    if (this.tickElements.length > ticks.length) {
      for (let i = ticks.length; i < this.tickElements.length; i++) {
        const { line, text } = this.tickElements[i];
        line.parentElement?.removeChild(line);
        text.parentElement?.removeChild(text);
      }
    }
  }

  private showSelectedSpanConnections(spanId: string) {
    const [groupView, spanView] = this.findSpanView(spanId);
    if (!groupView || !spanView) return;
    const span = spanView.span;
    const that = this;

    // Clean-up
    this.decorations.selectedSpanConnections.forEach((d) => d.unmount());
    this.decorations.selectedSpanConnections = [];

    // Parent connection(s) recursive
    handleParentConnection(span);

    function handleParentConnection(span: Span) {
      // CAUTION: We're assuming the first `childOf` or `followsFrom` reference as the parent.
      const parentRef = find(span.references, (ref) => {
        return ref.type == 'childOf' || ref.type == 'followsFrom';
      });
      if (!parentRef) return;

      const [refGroupView, refSpanView] = that.findSpanView(parentRef.spanId);
      if (!refGroupView || !refSpanView) return;

      const decoration = new SpanConnectionDecoration(that);
      decoration.prepare({
        spanId1: refSpanView.span.id,
        spanId2: span.id,
        strokeDasharray: parentRef.type == 'followsFrom' ? '2' : '0',
      });
      decoration.update();
      decoration.mount();

      that.decorations.selectedSpanConnections.push(decoration);
      handleParentConnection(refSpanView.span);
    }

    // Children connections
    const childrenMatches = this.findSpanViews((v) => {
      const selfReferences = find(
        v.span.references,
        (r) => r.spanId === span.id
      );
      return !!selfReferences;
    });

    childrenMatches.forEach(([refGroupView, refSpanView]) => {
      const ref = find(
        refSpanView.span.references,
        (r) => r.spanId === span.id
      );
      const decoration = new SpanConnectionDecoration(this);
      decoration.prepare({
        spanId1: span.id,
        spanId2: refSpanView.span.id,
        strokeDasharray: ref.type == 'followsFrom' ? '2' : '0',
      });
      decoration.update();
      decoration.mount();

      this.decorations.selectedSpanConnections.push(decoration);
    });
  }

  // Sorry for duplication, or not sorry
  private showHoveredSpanConnections(spanId: string) {
    const [groupView, spanView] = this.findSpanView(spanId);
    if (!groupView || !spanView) return;
    const span = spanView.span;

    // Clean-up
    this.decorations.hoveredSpanConnections.forEach((d) => d.unmount());
    this.decorations.hoveredSpanConnections = [];

    // Parent connection(s)
    span.references.forEach((ref) => {
      const [refGroupView, refSpanView] = this.findSpanView(ref.spanId);
      if (!refGroupView || !refSpanView) return;

      const decoration = new SpanConnectionDecoration(this);
      decoration.prepare({
        spanId1: refSpanView.span.id,
        spanId2: span.id,
        strokeDasharray: ref.type == 'followsFrom' ? '2' : '0',
      });
      decoration.update();
      decoration.mount();

      this.decorations.hoveredSpanConnections.push(decoration);
    });

    // Children connections
    const childrenMatches = this.findSpanViews((v) => {
      const selfReferences = find(
        v.span.references,
        (r) => r.spanId === span.id
      );
      return !!selfReferences;
    });

    childrenMatches.forEach(([refGroupView, refSpanView]) => {
      const ref = find(
        refSpanView.span.references,
        (r) => r.spanId === span.id
      );
      const decoration = new SpanConnectionDecoration(this);
      decoration.prepare({
        spanId1: span.id,
        spanId2: refSpanView.span.id,
        strokeDasharray: ref.type == 'followsFrom' ? '2' : '0',
      });
      decoration.update();
      decoration.mount();

      this.decorations.hoveredSpanConnections.push(decoration);
    });
  }
}
