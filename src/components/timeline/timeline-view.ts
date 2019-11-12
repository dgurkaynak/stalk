import * as _ from 'lodash';
import GroupView, { GroupLayoutType } from './group-view';
import Axis from './axis';
import vc from './view-constants';
import EventEmitterExtra from 'event-emitter-extra';
// import AnnotationManager from './annotations/manager';
import MouseHandler from './mouse-handler';
import SpanView, { SpanViewSharedOptions } from './span-view';
import { Trace } from '../../model/trace';
import { SpanGrouping, SpanGroupingOptions } from '../../model/span-grouping/span-grouping';
import processSpanGroupingOptions from '../../model/span-grouping/process';
import { TimelineInteractableElementAttribute, TimelineInteractedElementObject } from './interaction';
import { SpanColoringOptions, operationColoringOptions } from '../../model/span-coloring-manager';
import { SpanLabellingOptions, operationLabellingOptions } from '../../model/span-labelling-manager';
import LogHighlightDecoration from './decorations/log-highlight';
import SpanConnectionsDecoration from './decorations/span-connections';
import VerticalLineDecoration from './decorations/vertical-line';
import IntervalHighlightDecoration from './decorations/interval-highlight';

const SVG_NS = 'http://www.w3.org/2000/svg';


export default class TimelineView extends EventEmitterExtra {
  private svg = document.createElementNS(SVG_NS, 'svg');

  private defs = document.createElementNS(SVG_NS, 'defs');
  private viewportClipPath = document.createElementNS(SVG_NS, 'clipPath');
  private viewportClipPathRect = document.createElementNS(SVG_NS, 'rect');

  private viewportContainer = document.createElementNS(SVG_NS, 'g');
  private groupNamePanel = document.createElementNS(SVG_NS, 'g');
  private timelinePanel = document.createElementNS(SVG_NS, 'g');

  readonly decorationUnderlayPanel = document.createElementNS(SVG_NS, 'g');
  readonly decorationOverlayPanel = document.createElementNS(SVG_NS, 'g');
  readonly decorations = {
    logHighlight: new LogHighlightDecoration(this),
    spanConnections: new SpanConnectionsDecoration(this),
    cursorLine: new VerticalLineDecoration(this),
    intervalHighlight: new IntervalHighlightDecoration(this),
  };

  private _width = 0; // svg width
  get width() { return this._width; }
  private _height = 0; // svg height
  get height() { return this._height; }
  private panelTranslateY = 0;
  private _contentHeight = 0; // in pixels
  get contentHeight() { return this._contentHeight; }

  readonly mouseHandler = new MouseHandler(this.svg);
  readonly axis = new Axis([0, 0], [0, 0]);

  private traces: Trace[] = [];
  private spanGrouping: SpanGrouping;
  private groupViews: GroupView[] = [];

  private groupLayoutMode = GroupLayoutType.FILL;
  private readonly spanViewSharedOptions: SpanViewSharedOptions = {
    axis: this.axis,
    colorFor: operationColoringOptions.colorBy,
    labelFor: operationLabellingOptions.labelBy,
  };

  constructor() {
    super();

    this.svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
    this.svg.classList.add('timeline-svg');

    this.svg.appendChild(this.defs);

    // this.annotation.cursorLineAnnotation.prepare({ timestamp: null, lineColor: this.viewSettings.cursorLineColor });
    // this.viewSettings.showCursorLine && this.annotation.cursorLineAnnotation.mount();

    const spanShadowFilter = document.createElementNS(SVG_NS, 'filter');
    spanShadowFilter.id = 'span-shadow';
    spanShadowFilter.setAttribute('x', '-50%');
    spanShadowFilter.setAttribute('y', '-50%');
    spanShadowFilter.setAttribute('width', '200%');
    spanShadowFilter.setAttribute('height', '200%');
    spanShadowFilter.innerHTML = `<feDropShadow stdDeviation="3 3" in="SourceGraphic" dx="0" dy="0" flood-color="#1F3646" flood-opacity="0.5" result="dropShadow"/>`;
    this.defs.appendChild(spanShadowFilter);

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
    this.spanGrouping = new SpanGrouping(processSpanGroupingOptions);
  }

  init(parentElement: HTMLElement, options?: {
    width?: number,
    height?: number,
  }) {
    let width = options && options.width;
    let height = options && options.height;
    if (!width || !height) {
      const { offsetWidth, offsetHeight } = parentElement;
      width = offsetWidth;
      height = offsetHeight;
    }
    this.resize(width, height);
    this.setupPanels();
    this.mouseHandler.init();

    parentElement.appendChild(this.svg);
  }

  resize(width: number, height: number) {
    this._width = width;
    this._height = height;

    this.svg.setAttribute('width', `${width}`);
    this.svg.setAttribute('height', `${height}`);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    this.decorations.cursorLine.update();

    this.viewportClipPathRect.setAttribute('width', `${width}`);
    this.viewportClipPathRect.setAttribute('height', `${height}`);

    this.axis.updateOutputRange([
      vc.spanBarViewportMargin,
      width - vc.spanBarViewportMargin
    ]);
    // TODO: Look for who listens AxisEvent.UPDATED event and trigger here
    this.groupViews.forEach(g => g.handleAxisUpdate());
    this.updateAllDecorations();

    this.groupViews.forEach(v => v.updateSeperatorLineWidths(width));
  }

  updateAllDecorations(forceReprepare = false) {
    _.forEach(this.decorations, (decoration) => {
      if (forceReprepare) {
        const rv = decoration.prepare({} as any);
        if (rv === false) decoration.unmount();
      }
      decoration.update();
    });
  }

  setupPanels() {
    const { _width: width, _height: height } = this;

    this.viewportClipPath.id = 'viewport-clip-path';
    this.viewportClipPathRect.setAttribute('x', `0`);
    this.viewportClipPathRect.setAttribute('y', `0`);
    this.viewportClipPathRect.setAttribute('width', `${width}`);
    this.viewportClipPathRect.setAttribute('height', `${height}`);
    this.viewportClipPath.appendChild(this.viewportClipPathRect);
    this.defs.appendChild(this.viewportClipPath);

    this.viewportContainer.setAttribute('clip-path', 'url(#viewport-clip-path)');
    this.viewportContainer.appendChild(this.decorationUnderlayPanel);
    this.viewportContainer.appendChild(this.groupNamePanel);
    this.viewportContainer.appendChild(this.timelinePanel);
    this.viewportContainer.appendChild(this.decorationOverlayPanel);
    this.svg.appendChild(this.viewportContainer);
  }

  // Array order is from deepest element to root
  getInteractedElementsFromMouseEvent(e: MouseEvent): TimelineInteractedElementObject[] {
    let element = e.target as (SVGElement | null);
    const matches: TimelineInteractedElementObject[] = [];

    while (element && element !== this.svg) {
      if (element.hasAttribute(TimelineInteractableElementAttribute)) {
        matches.push({
          type: element.getAttribute(TimelineInteractableElementAttribute)! as any,
          element: element
        });
      }
      element = (element.parentElement as unknown) as SVGElement;
    }

    return matches;
  }

  dispose() {
    this.mouseHandler.dispose();
  }

  updateGroupLayoutMode(groupLayoutType: GroupLayoutType) {
    this.groupLayoutMode = groupLayoutType;
    this.groupViews.forEach((g) => {
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
    this.traces.forEach(t => t.spans.forEach(s => this.spanGrouping.addSpan(s, t)));
    this.layout();
  }

  updateSpanColoring(options: SpanColoringOptions) {
    this.spanViewSharedOptions.colorFor = options.colorBy;
    this.groupViews.forEach((g) => {
      const spanViews = g.getAllSpanViews();
      spanViews.forEach(s => s.updateColors());
    });
  }

  updateSpanLabelling(options: SpanLabellingOptions) {
    this.spanViewSharedOptions.labelFor = options.labelBy;
    this.groupViews.forEach((g) => {
      const spanViews = g.getAllSpanViews();
      spanViews.forEach(s => s.updateLabelText());
    });
  }

  addTrace(trace: Trace) {
    const idMatch = _.find(this.traces, t => t.id === trace.id);
    if (idMatch) return false;
    this.traces.push(trace);
    trace.spans.forEach(s => this.spanGrouping.addSpan(s, trace));
    this.layout();
    return true;
  }

  removeTrace(trace: Trace) {
    const removeds = _.remove(this.traces, t => t.id === trace.id);
    if (removeds.length === 0) return false;
    trace.spans.forEach(s => this.spanGrouping.removeSpan(s));
    this.layout();
    return true;
  }

  findGroupView(groupId: string | ((groupView: GroupView) => boolean)): GroupView | undefined {
    if (_.isString(groupId)) {
      return _.find(this.groupViews, g => g.spanGroup.id === groupId);
    } else if (_.isFunction(groupId)) {
      return _.find(this.groupViews, groupId);
    } else {
      throw new Error('Unsupported argument type');
    }
  }

  findSpanView(spanId: string | ((spanView: SpanView) => boolean)): [
    GroupView | undefined,
    SpanView | undefined
  ] {
    if (_.isString(spanId)) {
      const groupView = _.find(this.groupViews, g => !!g.getSpanViewById(spanId));
      return [
        groupView,
        groupView && groupView.getSpanViewById(spanId)
      ];
    } else if (_.isFunction(spanId)) {
      for (let groupView of this.groupViews) {
        const spanViews = groupView.getAllSpanViews();
        const spanView = _.find(spanViews, spanId);
        if (spanView) {
          return [ groupView, spanView ];
        }
      }
      return [ undefined, undefined ];
    } else {
      throw new Error('Unsupported argument type');
    }
  }

  findSpanViews(predicate: (spanView: SpanView) => boolean): [GroupView, SpanView][] {
    const acc: [GroupView, SpanView][] = [];
    for (let groupView of this.groupViews) {
      const spanViews = groupView.getAllSpanViews();
      spanViews
        .filter(predicate)
        .forEach((spanView) => {
          acc.push([groupView, spanView]);
        });
    }
    return acc;
  }

  layout() {
    let startTimestamp = Infinity;
    let finishTimestamp = -Infinity;
    this.traces.forEach((trace) => {
      startTimestamp = Math.min(startTimestamp, trace.startTime);
      finishTimestamp = Math.max(finishTimestamp, trace.finishTime);
    });

    this.axis.reset(
      [startTimestamp, finishTimestamp],
      [
        vc.spanBarViewportMargin,
        this._width - vc.spanBarViewportMargin
      ]
    );

    this.groupViews.forEach(v => v.dispose());
    this.groupViews = [];

    const groups = this.spanGrouping.getAllGroups().sort((a, b) => a.startTimestamp - b.startTimestamp);
    groups.forEach((group) => {
      const groupView = new GroupView(group, { width: this._width, layoutType: this.groupLayoutMode });
      groupView.init({
        groupNamePanel: this.groupNamePanel,
        timelinePanel: this.timelinePanel,
        svgDefs: this.defs,
        spanViewSharedOptions: this.spanViewSharedOptions
      });
      groupView.layout();

      this.groupViews.push(groupView);
    });

    this.updateGroupVerticalPositions();

    // Annotations
    this.updateAllDecorations(true); // Force re-prepare because all the groupViews and spanViews are replaced w/ new

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
        y += groupPaddingTop + groupPaddingBottom + (groupView.heightInRows * rowHeight);
      }
    });

    this._contentHeight = y;
  }

  translateX(delta: number) {
    this.axis.translate(delta);
    // TODO: Look for who listens AxisEvent.TRANSLATED
    this.groupViews.forEach(g => g.handleAxisTranslate());
    this.updateAllDecorations();
  }

  translateY(delta: number) {
    const { _height: viewportHeight } = this;
    if (this._contentHeight <= viewportHeight) return;

    const newTranslateY = this.panelTranslateY + delta;
    const panelTranslateY = Math.min(Math.max(newTranslateY, viewportHeight - this._contentHeight), 0);
    this.setPanelTranslateY(panelTranslateY);
  }

  setPanelTranslateY(y: number) {
    this.panelTranslateY = y;
    this.groupNamePanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.timelinePanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.decorationUnderlayPanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.decorationOverlayPanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
  }

  keepPanelTraslateYInScreen() {
    const { _height: viewportHeight } = this;
    const bottomY = this.panelTranslateY + this._contentHeight;
    const offsetSnapToBottom = viewportHeight - bottomY;
    if (offsetSnapToBottom <= 0) return;
    const newTranslateY = Math.min(this.panelTranslateY + offsetSnapToBottom, 0); // Can be max 0
    this.setPanelTranslateY(newTranslateY);
  }

  zoom(scaleFactor: number, anchorPosX: number) {
    this.axis.zoom(scaleFactor, anchorPosX);
    // TODO: Look for who listens AxisEvent.ZOOMED
    this.groupViews.forEach(g => g.handleAxisZoom());
    this.updateAllDecorations();
  }
}
