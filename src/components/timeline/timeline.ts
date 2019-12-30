import forEach from 'lodash/forEach';
import find from 'lodash/find';
import remove from 'lodash/remove';
import uniq from 'lodash/uniq';
import isString from 'lodash/isString';
import isArray from 'lodash/isArray';
import isFunction from 'lodash/isFunction';
import differenceBy from 'lodash/differenceBy';
import GroupView, { GroupLayoutType } from './group-view';
import Axis from './axis';
import vc from './view-constants';
import EventEmitter from 'events';
import MouseHandler, { MouseHandlerEvent } from './mouse-handler';
import SpanView, { SpanViewSharedOptions } from './span-view';
import { Trace } from '../../model/trace';
import {
  SpanGrouping,
  SpanGroupingOptions
} from '../../model/span-grouping/span-grouping';
import processSpanGroupingOptions from '../../model/span-grouping/process';
import {
  TimelineInteractableElementAttribute,
  TimelineInteractableElementType,
  TimelineInteractedElementObject
} from './interaction';
import {
  SpanColoringOptions,
  operationColoringOptions
} from '../../model/span-coloring-manager';
import {
  SpanLabellingOptions,
  operationLabellingOptions
} from '../../model/span-labelling-manager';
import LogHighlightDecoration from './decorations/log-highlight';
import SpanConnectionsDecoration from './decorations/span-connections';
import prettyMilliseconds from 'pretty-ms';
import SelectionView from './selection-view';
import { SpanTooltipContent } from '../span-tooltip/span-tooltip-content';
import tippy, { Instance as TippyInstance } from 'tippy.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export enum TimelineEvent {
  SPANS_SELECTED = 'tve_span_selected'
}

export enum TimelineTool {
  MOVE = 'move',
  SELECTION = 'selection'
}

export class Timeline extends EventEmitter {
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
    logHighlight: new LogHighlightDecoration(this),
    selectedSpansConnections: [] as SpanConnectionsDecoration[],
    hoveredSpanConnections: new SpanConnectionsDecoration(this)
  };

  private _width = 0; // svg width
  get width() {
    return this._width;
  }
  private _height = 0; // svg height
  get height() {
    return this._height;
  }
  private panelTranslateY = 0;
  private _contentHeight = 0; // in pixels
  get contentHeight() {
    return this._contentHeight;
  }

  readonly mouseHandler = new MouseHandler(this.svg);
  readonly axis = ((window as any).axis = new Axis([0, 0], [0, 0]));

  private traces: Trace[] = [];
  private spanGrouping: SpanGrouping;
  private groupViews: GroupView[] = [];

  private groupLayoutMode = GroupLayoutType.COMPACT; // Do not forget to change related config in timeline-wrapper
  private readonly spanViewSharedOptions: SpanViewSharedOptions = {
    axis: this.axis,
    colorFor: operationColoringOptions.colorBy, // Do not forget to change related config in timeline-wrapper
    labelFor: operationLabellingOptions.labelBy // Do not forget to change related config in timeline-wrapper
  };

  private hoveredElements: TimelineInteractedElementObject[] = [];
  private selectedSpanIds: string[] = [];

  private selectionView = new SelectionView({
    parentEl: this.svg,
    axis: this.axis
  });

  private _tool = TimelineTool.MOVE;

  private spanTooltipTippy: TippyInstance;
  private spanTooltipContent = new SpanTooltipContent({
    axis: this.axis
  });
  private spanTooltipStuffCache = {
    svgBBTop: 0,
    idleMouseClientX: 0
  };

  private binded = {
    onMouseIdleMove: this.onMouseIdleMove.bind(this),
    onMouseIdleLeave: this.onMouseIdleLeave.bind(this),
    onMousePanStart: this.onMousePanStart.bind(this),
    onMousePanMove: this.onMousePanMove.bind(this),
    onMousePanEnd: this.onMousePanEnd.bind(this),
    onWheel: this.onWheel.bind(this),
    onClick: this.onClick.bind(this)
  };

  constructor() {
    super();

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
    let width = options && options.width;
    let height = options && options.height;
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
              right: 0
            };
          }
        };
      }
    });
    // this.spanTooltipTippy.hide = () => {};
  }

  mount(parentElement: HTMLDivElement) {
    parentElement.appendChild(this.svg);
  }

  unmount() {
    this.svg.parentElement && this.svg.parentElement.removeChild(this.svg);
  }

  resize(width: number, height: number) {
    this._width = width;
    this._height = height;

    this.svg.setAttribute('width', `${width}`);
    this.svg.setAttribute('height', `${height}`);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    this.bodyClipPathRect.setAttribute('width', `${width}`);
    this.bodyClipPathRect.setAttribute(
      'height',
      `${height - vc.timeHeaderHeight}`
    );

    this.axis.updateOutputRange([
      vc.spanBarViewportMargin,
      width - vc.spanBarViewportMargin
    ]);
    // TODO: Look for who listens AxisEvent.UPDATED event and trigger here
    this.groupViews.forEach(g => g.handleAxisUpdate());
    this.updateAllDecorations();
    this.updateTicks();

    this.groupViews.forEach(v => v.updateSeperatorLineWidths(width));
    this.keepPanelTraslateYInScreen();

    const svgRect = this.svg.getBoundingClientRect();
    this.spanTooltipStuffCache.svgBBTop = svgRect.top;
  }

  updateAllDecorations(forceReprepare = false) {
    forEach(this.decorations, decoration => {
      const decorations = isArray(decoration) ? decoration : [decoration];

      if (forceReprepare) {
        decorations.forEach(d => {
          const rv = d.prepare({} as any);
          if (rv === false) d.unmount();
        });
      }

      decorations.forEach(d => d.update());
    });
  }

  setupPanels() {
    const { _width: width, _height: height } = this;

    this.bodyClipPath.id = 'body-clip-path';
    this.bodyClipPathRect.setAttribute('x', `0`);
    this.bodyClipPathRect.setAttribute('y', `0`);
    this.bodyClipPathRect.setAttribute('width', `${width}`);
    this.bodyClipPathRect.setAttribute(
      'height',
      `${height - vc.timeHeaderHeight}`
    );
    this.bodyClipPath.appendChild(this.bodyClipPathRect);
    this.defs.appendChild(this.bodyClipPath);

    this.svg.appendChild(this.tickContainer);

    this.bodyContainer.setAttribute('x', `0`);
    this.bodyContainer.setAttribute('y', `0`);
    this.bodyContainer.setAttribute(
      'transform',
      `translate(0, ${vc.timeHeaderHeight})`
    );
    this.bodyContainer.setAttribute('clip-path', 'url(#body-clip-path)');
    this.bodyContainer.appendChild(this.decorationUnderlayPanel);
    this.bodyContainer.appendChild(this.groupNamePanel);
    this.bodyContainer.appendChild(this.timelinePanel);
    this.bodyContainer.appendChild(this.decorationOverlayPanel);
    this.svg.appendChild(this.bodyContainer);
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
          element: element
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

  updateGroupLayoutMode(groupLayoutType: GroupLayoutType) {
    this.groupLayoutMode = groupLayoutType;
    this.groupViews.forEach(g => {
      g.setLayoutType(groupLayoutType);
      g.layout();
    });
    this.updateGroupVerticalPositions();
    this.updateAllDecorations();
    this.keepPanelTraslateYInScreen();
  }

  updateSpanGrouping(spanGroupingOptions: SpanGroupingOptions) {
    // TODO: Dispose previous grouping maybe?
    this.spanGrouping = new SpanGrouping(spanGroupingOptions);
    this.traces.forEach(t =>
      t.spans.forEach(s => this.spanGrouping.addSpan(s, t))
    );
    this.layout();
  }

  updateSpanColoring(options: SpanColoringOptions) {
    this.spanViewSharedOptions.colorFor = options.colorBy;
    this.groupViews.forEach(g => {
      const spanViews = g.getAllSpanViews();
      spanViews.forEach(s => s.updateColors());
    });
  }

  updateSpanLabelling(options: SpanLabellingOptions) {
    this.spanViewSharedOptions.labelFor = options.labelBy;
    this.groupViews.forEach(g => {
      const spanViews = g.getAllSpanViews();
      spanViews.forEach(s => s.updateLabelText());
    });
  }

  get tool() {
    return this._tool;
  }

  updateTool(tool: TimelineTool) {
    this._tool = tool;
  }

  addTrace(trace: Trace) {
    const idMatch = find(this.traces, t => t.id === trace.id);
    if (idMatch) return false;
    this.traces.push(trace);
    trace.spans.forEach(s => this.spanGrouping.addSpan(s, trace));
    this.layout();
    return true;
  }

  removeTrace(trace: Trace) {
    const removeds = remove(this.traces, t => t.id === trace.id);
    if (removeds.length === 0) return false;
    trace.spans.forEach(s => this.spanGrouping.removeSpan(s));
    this.layout();
    return true;
  }

  findGroupView(
    groupId: string | ((groupView: GroupView) => boolean)
  ): GroupView | undefined {
    if (isString(groupId)) {
      return find(this.groupViews, g => g.spanGroup.id === groupId);
    } else if (isFunction(groupId)) {
      return find(this.groupViews, groupId);
    } else {
      throw new Error('Unsupported argument type');
    }
  }

  findSpanView(
    spanId: string | ((spanView: SpanView) => boolean)
  ): [GroupView | undefined, SpanView | undefined] {
    if (isString(spanId)) {
      const groupView = find(this.groupViews, g => !!g.getSpanViewById(spanId));
      return [groupView, groupView && groupView.getSpanViewById(spanId)];
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
  ): [GroupView, SpanView][] {
    const acc: [GroupView, SpanView][] = [];
    for (let groupView of this.groupViews) {
      const spanViews = groupView.getAllSpanViews();
      spanViews.filter(predicate).forEach(spanView => {
        acc.push([groupView, spanView]);
      });
    }
    return acc;
  }

  findSpanViewsByRect(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    // in px, relative to svg
    // Substract time header height to match with internal representation
    rect.y -= vc.timeHeaderHeight;
    // Add already translated y
    rect.y -= this.panelTranslateY;

    const acc: [GroupView, SpanView][] = [];
    const startTime = this.axis.output2input(rect.x);
    const finishTime = this.axis.output2input(rect.x + rect.width);

    for (let groupView of this.groupViews) {
      const spanViews = groupView.getAllSpanViews();
      const groupY = groupView.getViewPropertiesCache().y;
      spanViews.forEach(spanView => {
        const spanAbsoluteY = spanView.getViewPropertiesCache().y + groupY;
        const isInstersected = !(
          spanView.span.startTime > finishTime ||
          spanView.span.finishTime < startTime ||
          spanAbsoluteY > rect.y + rect.height ||
          spanAbsoluteY + vc.spanBarHeight < rect.y
        );
        if (isInstersected) {
          acc.push([groupView, spanView]);
        }
      });
    }

    return acc;
  }

  layout() {
    let startTimestamp = Infinity;
    let finishTimestamp = -Infinity;
    this.traces.forEach(trace => {
      startTimestamp = Math.min(startTimestamp, trace.startTime);
      finishTimestamp = Math.max(finishTimestamp, trace.finishTime);
    });

    this.axis.reset(
      [startTimestamp, finishTimestamp],
      [vc.spanBarViewportMargin, this._width - vc.spanBarViewportMargin]
    );

    this.groupViews.forEach(v => v.dispose());
    this.groupViews = [];

    const groups = this.spanGrouping
      .getAllGroups()
      .sort((a, b) => a.startTimestamp - b.startTimestamp);
    groups.forEach(group => {
      const groupView = new GroupView(group, {
        width: this._width,
        layoutType: this.groupLayoutMode
      });
      groupView.init({
        groupNamePanel: this.groupNamePanel,
        timelinePanel: this.timelinePanel,
        svgDefs: this.defs,
        spanViewSharedOptions: this.spanViewSharedOptions
      });
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
    const { groupPaddingTop, groupPaddingBottom, rowHeight } = vc;
    let y = 0;

    this.groupViews.forEach((groupView, i) => {
      groupView.updatePosition({ y });
      if (groupView.options.isCollapsed) {
        y += groupPaddingTop;
      } else {
        y +=
          groupPaddingTop +
          groupPaddingBottom +
          groupView.heightInRows * rowHeight;
      }
    });

    this._contentHeight = y;
  }

  translateX(delta: number) {
    this.axis.translate(delta);
    // TODO: Look for who listens AxisEvent.TRANSLATED
    this.groupViews.forEach(g => g.handleAxisTranslate());
    this.updateAllDecorations();
    this.updateTicks();
  }

  translateY(delta: number) {
    const bodyHeight = this._height - vc.timeHeaderHeight;
    if (this._contentHeight <= bodyHeight) return;

    const newTranslateY = this.panelTranslateY + delta;
    const panelTranslateY = Math.min(
      Math.max(newTranslateY, bodyHeight - this._contentHeight),
      0
    );
    this.setPanelTranslateY(panelTranslateY);
  }

  setPanelTranslateY(y: number) {
    this.panelTranslateY = y;
    this.groupNamePanel.setAttribute(
      'transform',
      `translate(0, ${this.panelTranslateY})`
    );
    this.timelinePanel.setAttribute(
      'transform',
      `translate(0, ${this.panelTranslateY})`
    );
    this.decorationUnderlayPanel.setAttribute(
      'transform',
      `translate(0, ${this.panelTranslateY})`
    );
    this.decorationOverlayPanel.setAttribute(
      'transform',
      `translate(0, ${this.panelTranslateY})`
    );
  }

  getPanelTranslateY() {
    return this.panelTranslateY;
  }

  private keepPanelTraslateYInScreen() {
    const bodyHeight = this._height - vc.timeHeaderHeight;
    const bottomY = this.panelTranslateY + this._contentHeight;
    const offsetSnapToBottom = bodyHeight - bottomY;
    if (offsetSnapToBottom <= 0) return;
    const newTranslateY = Math.min(
      this.panelTranslateY + offsetSnapToBottom,
      0
    ); // Can be max 0
    this.setPanelTranslateY(newTranslateY);
  }

  zoom(scaleFactor: number, anchorPosX: number) {
    this.axis.zoom(scaleFactor, anchorPosX);
    // TODO: Look for who listens AxisEvent.ZOOMED
    this.groupViews.forEach(g => g.handleAxisZoom());
    this.updateAllDecorations();
    this.updateTicks();
  }

  selectSpans(spanIds: string[]) {
    spanIds = uniq(spanIds);

    // If a span is already selected, update its style
    const previousSelectedSpanIds = this.selectedSpanIds;
    if (previousSelectedSpanIds.length > 0) {
      previousSelectedSpanIds.forEach(spanId => {
        const previousSelectedSpanView = this.findSpanView(spanId)[1];
        if (previousSelectedSpanView) {
          previousSelectedSpanView.updateColorStyle('normal');
          previousSelectedSpanView.hideLogs();
        }
      });
    }

    // Unmount all the selected spans connections
    this.decorations.selectedSpansConnections.forEach(sc => sc.unmount());
    this.decorations.hoveredSpanConnections.unmount();

    this.selectedSpanIds = spanIds;
    spanIds.forEach((spanId, i) => {
      // If new span exists
      const [groupView, spanView] = spanId
        ? this.findSpanView(spanId)
        : [null, null];
      if (spanId && spanView && groupView) {
        spanView.updateColorStyle('selected');
        spanView.showLogs();
        groupView.bringSpanViewToTop(spanId);

        // If there is no decorator in the pool, create a new one
        if (!this.decorations.selectedSpansConnections[i]) {
          this.decorations.selectedSpansConnections[
            i
          ] = new SpanConnectionsDecoration(this);
        }

        const sc = this.decorations.selectedSpansConnections[i];
        sc.prepare({ spanId: spanId });
        sc.update();
        sc.mount();
      }
    });

    // If there are remaining span connections, release them
    // You may disable this to re-use them all the time, however
    // if user selected all the spans, it may cause performance degradation.
    if (this.decorations.selectedSpansConnections.length > spanIds.length) {
      this.decorations.selectedSpansConnections = this.decorations.selectedSpansConnections.slice(
        0,
        spanIds.length
      );
    }

    this.emit(TimelineEvent.SPANS_SELECTED, null);
  }

  ////////////////////////////////////////
  //////////// EVENT-HANDLING ////////////
  ////////////////////////////////////////

  onMouseIdleMove(e: MouseEvent) {
    if (this.traces.length === 0) return;

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
          if (this.selectedSpanIds.indexOf(spanId) > -1) return;
          const spanView = this.findSpanView(spanId)[1];
          if (!spanView) return;
          spanView.updateColorStyle('normal');
          spanView.hideLogs();
          this.decorations.hoveredSpanConnections.unmount();
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
                const spanViewProp = spanView.getViewPropertiesCache();
                const groupViewProp = groupView.getViewPropertiesCache();
                const top =
                  this.spanTooltipStuffCache.svgBBTop +
                  spanViewProp.y +
                  groupViewProp.y +
                  vc.timeHeaderHeight +
                  this.panelTranslateY;
                return {
                  width: 0,
                  height: vc.spanBarHeight,
                  top: top,
                  bottom: top + vc.spanBarHeight,
                  left: this.spanTooltipStuffCache.idleMouseClientX,
                  right: this.spanTooltipStuffCache.idleMouseClientX
                };
              }
            });
            this.spanTooltipTippy.popperInstance.update();
            this.spanTooltipTippy.show();
          }

          // If it's already selected, early terminate
          // Because we don't want to update span style or show span connection
          // It's already showing by selection logic
          if (this.selectedSpanIds.indexOf(spanId) > -1) return;
          if (!spanView) return;
          spanView.updateColorStyle('hover');
          spanView.showLogs();

          this.decorations.hoveredSpanConnections.prepare({ spanId: spanId });
          this.decorations.hoveredSpanConnections.update();
          this.decorations.hoveredSpanConnections.mount();

          return;
        }
      }
    });

    if (removed.length === 0 && added.length === 0) return;

    // TODO: Unhighligh logs in the sidebar
    // this.setState({ highlightedLogId: '' });

    // TODO: If log is hovered and its span is selected, highlight and scroll to log
    // added.forEach(({ type, element }) => {
    //   if (type !== TimelineInteractableElementType.SPAN_VIEW_LOG_CIRCLE) return;
    //   const { spanId, id: logId } = SpanView.getPropsFromLogCircle(element);
    //   if (!spanId || !logId) return;
    //   if (spanId !== selectedSpanView.span.id) return;
    //   this.highlightAndScrollToLog(logId);
    // });
  }

  onMouseIdleLeave(e: MouseEvent) {
    this.decorations.hoveredSpanConnections.unmount();
    this.spanTooltipTippy.hide();
  }

  onMousePanStart(e: MouseEvent) {
    this.spanTooltipTippy.hide();
    this.selectionView.unmount();

    if (this.traces.length === 0) return;

    if (this._tool == TimelineTool.SELECTION) {
      this.selectionView.start(e.offsetX, e.offsetY);
      this.selectionView.update(e.offsetX, e.offsetY);
      this.selectionView.mount();
    }
  }

  onMousePanMove(e: MouseEvent) {
    if (this.traces.length === 0) return;

    if (this._tool == TimelineTool.SELECTION) {
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

    if (this._tool == TimelineTool.SELECTION && !isMouseLeaveBeforeUp) {
      // TODO: e.offsetX, e.offsetY are way wrong, fix it in MouseHandler;
      const rect = this.selectionView.stop();
      const matches = this.findSpanViewsByRect(rect);
      const spanIds = matches.map(([g, s]) => s.span.id);
      this.selectSpans(spanIds);
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
    const matches = this.getInteractedElementsFromMouseEvent(e);

    let clickedSpanId: string | null = null;
    let clickedGroupLabelId: string | null = null;

    forEach(matches, ({ type, element }) => {
      switch (type) {
        case TimelineInteractableElementType.SPAN_VIEW_CONTAINER: {
          const { id: spanId } = SpanView.getPropsFromContainer(element);
          if (!spanId) return;
          clickedSpanId = spanId;
          return;
        }

        case TimelineInteractableElementType.GROUP_VIEW_LABEL_TEXT: {
          const { id: groupId } = GroupView.getPropsFromLabelText(element);
          if (!groupId) return;
          clickedGroupLabelId = groupId;
          return;
        }
      }
    });

    const groupView =
      clickedGroupLabelId && this.findGroupView(clickedGroupLabelId);
    if (clickedGroupLabelId && groupView) {
      const isVisible = groupView.toggleView();
      this.updateGroupVerticalPositions();
      this.keepPanelTraslateYInScreen();
      this.updateAllDecorations();

      // TODO: Selected span can be collapsed right now
      // TODO: A reference-connected span can be collapsed/expanded now

      return; // Early terminate so that selection does not lost
    }

    if (e.ctrlKey || e.metaKey) {
      // If ctrl or cmd key is pressed and clicked on a span,
      // add to selection, if not clicked on span, noop
      clickedSpanId &&
        this.selectSpans([...this.selectedSpanIds, clickedSpanId]);
    } else {
      // Select clicked span, or nothing (deselectes all of them)
      this.selectSpans(clickedSpanId ? [clickedSpanId] : []);
    }
  }

  ///////////////////////////////////////
  //////////// TICK HANDLING ////////////
  ///////////////////////////////////////

  updateTicks() {
    if (this.traces.length == 0) {
      this.tickElements.forEach(({ text, line }) => {
        text.parentElement && text.parentElement.removeChild(text);
        line.parentElement && line.parentElement.removeChild(line);
      });
      return;
    }

    const tickCount = Math.round(this._width / vc.tickLength);
    const ticks = this.axis.ticks(tickCount);

    ticks.forEach((tick, i) => {
      if (!this.tickElements[i]) {
        this.tickElements[i] = {
          line: document.createElementNS(SVG_NS, 'line'),
          text: document.createElementNS(SVG_NS, 'text')
        };
      }

      const { line, text } = this.tickElements[i];

      line.setAttribute('x1', tick.output + '');
      line.setAttribute('x2', tick.output + '');
      line.setAttribute('y1', '0');
      line.setAttribute('y2', this._height + '');
      line.setAttribute('stroke', vc.tickLineColor);
      line.setAttribute('stroke-width', '1');
      this.tickContainer.appendChild(line);

      text.textContent = prettyMilliseconds(tick.inputRelative / 1000, {
        secondsDecimalDigits: 3,
        millisecondsDecimalDigits: 1,
        keepDecimalsOnWholeSeconds: true,
        unitCount: 1
      } as any).replace('~', '');
      text.setAttribute('x', tick.output - 4 + '');
      text.setAttribute('y', vc.tickTextOffsetY + '');
      text.setAttribute('fill', vc.tickTextColor);
      text.setAttribute('font-size', vc.tickTextFontSize + '');
      text.setAttribute('text-anchor', 'end');
      this.tickContainer.appendChild(text);
    });

    // Remove unused ones
    if (this.tickElements.length > ticks.length) {
      for (let i = ticks.length; i < this.tickElements.length; i++) {
        const { line, text } = this.tickElements[i];
        line.parentElement && line.parentElement.removeChild(line);
        text.parentElement && text.parentElement.removeChild(text);
      }
    }
  }
}
