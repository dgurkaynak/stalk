import * as _ from 'lodash';
import GroupView, { GroupViewEvent } from './group-view';
import Axis from './axis';
import ViewSettings, { TimelineViewSettingsEvent } from './view-settings';
import EventEmitterExtra from 'event-emitter-extra';
import AnnotationManager from './annotations/manager';
import MouseHandler from './mouse-handler';
import SpanView from './span-view';
import { Trace } from '../../model/trace';
import { BaseSpanGrouping } from '../../model/span-grouping/base';
import SpanGroupingManager from '../../model/span-grouping/manager';
import { TimelineInteractableElementAttribute, TimelineInteractedElementObject } from './interaction';

const SVG_NS = 'http://www.w3.org/2000/svg';


export default class TimelineView extends EventEmitterExtra {
  private svg = document.createElementNS(SVG_NS, 'svg');

  private defs = document.createElementNS(SVG_NS, 'defs');
  private viewportClipPath = document.createElementNS(SVG_NS, 'clipPath');
  private viewportClipPathRect = document.createElementNS(SVG_NS, 'rect');

  private viewportContainer = document.createElementNS(SVG_NS, 'g');
  private groupNamePanel = document.createElementNS(SVG_NS, 'g');
  private timelinePanel = document.createElementNS(SVG_NS, 'g');
  private annotationUnderlayPanel = document.createElementNS(SVG_NS, 'g');
  private annotationOverlayPanel = document.createElementNS(SVG_NS, 'g');
  private panelTranslateY = 0;

  readonly mouseHandler = new MouseHandler(this.svg);

  private traces: Trace[] = [];
  readonly viewSettings = new ViewSettings();
  private groupingManager = SpanGroupingManager.getSingleton();
  private grouping: BaseSpanGrouping;
  private groupViews: GroupView[] = [];
  private contentHeight = 0; // in pixels

  annotation = new AnnotationManager({
    timelineView: this,
    underlayPanel: this.annotationUnderlayPanel,
    overlayPanel: this.annotationOverlayPanel,
    viewSettings: this.viewSettings
  });

  private binded = {
    onGroupingKeyChanged: this.onGroupingKeyChanged.bind(this),
  };


  constructor(options?: {
    viewSettings?: ViewSettings
  }) {
    super();

    if (options && options.viewSettings) this.viewSettings = options.viewSettings;
    this.svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
    this.svg.classList.add('timeline-svg');

    this.svg.appendChild(this.defs);

    this.annotation.cursorLineAnnotation.prepare({ timestamp: null, lineColor: this.viewSettings.cursorLineColor });
    this.viewSettings.showCursorLine && this.annotation.cursorLineAnnotation.mount();

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
    const GroupingClass = this.groupingManager.getConstructor(this.viewSettings.groupingKey) as any;
    if (!GroupingClass) throw new Error(`Grouping "${this.viewSettings.groupingKey}" not found`);
    this.grouping = new GroupingClass();
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
    this.bindEvents();
    this.mouseHandler.init();

    parentElement.appendChild(this.svg);
  }


  resize(width: number, height: number) {
    this.viewSettings.width = width;
    this.viewSettings.height = height;

    this.svg.setAttribute('width', `${width}`);
    this.svg.setAttribute('height', `${height}`);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    this.viewSettings.showCursorLine && this.annotation.cursorLineAnnotation.update();

    this.viewportClipPathRect.setAttribute('width', `${width}`);
    this.viewportClipPathRect.setAttribute('height', `${height}`);

    this.viewSettings.getAxis().updateOutputRange([
      this.viewSettings.spanBarViewportMargin,
      this.viewSettings.width - this.viewSettings.spanBarViewportMargin
    ]);

    this.groupViews.forEach(v => v.updateSeperatorLineWidths());
  }


  setupPanels() {
    const { width, height } = this.viewSettings;

    this.viewportClipPath.id = 'viewport-clip-path';
    this.viewportClipPathRect.setAttribute('x', `0`);
    this.viewportClipPathRect.setAttribute('y', `0`);
    this.viewportClipPathRect.setAttribute('width', `${width}`);
    this.viewportClipPathRect.setAttribute('height', `${height}`);
    this.viewportClipPath.appendChild(this.viewportClipPathRect);
    this.defs.appendChild(this.viewportClipPath);

    this.viewportContainer.setAttribute('clip-path', 'url(#viewport-clip-path)');
    this.viewportContainer.appendChild(this.annotationUnderlayPanel);
    this.viewportContainer.appendChild(this.groupNamePanel);
    this.viewportContainer.appendChild(this.timelinePanel);
    this.viewportContainer.appendChild(this.annotationOverlayPanel);
    this.svg.appendChild(this.viewportContainer);
  }

  bindEvents() {
    this.viewSettings.on(TimelineViewSettingsEvent.GROUPING_KEY_CHANGED, this.binded.onGroupingKeyChanged)
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
      element = element.parentElement as (SVGElement | null);
    }

    return matches;
  }

  dispose() {
    this.mouseHandler.dispose();
  }

  onGroupingKeyChanged() {
    const GroupingClass = this.groupingManager.getConstructor(this.viewSettings.groupingKey) as any;
    if (!GroupingClass) throw new Error(`Grouping "${this.viewSettings.groupingKey}" not found`);
    // TODO: Dispose previous grouping maybe?
    this.grouping = new GroupingClass();
    this.traces.forEach(t => t.spans.forEach(s => this.grouping.addSpan(s, t)));
    this.layout();
    this.annotation.logHighlightAnnotation.unmount();
    this.annotation.spanConnectionsAnnotation.unmount();
    this.annotation.intervalHighlightAnnotation.unmount();
  }

  addTrace(trace: Trace) {
    const idMatch = _.find(this.traces, t => t.id === trace.id);
    if (idMatch) return false;
    this.traces.push(trace);
    trace.spans.forEach(s => this.grouping.addSpan(s, trace));
    this.layout();
    this.annotation.logHighlightAnnotation.unmount();
    this.annotation.spanConnectionsAnnotation.unmount();
    this.annotation.intervalHighlightAnnotation.unmount();
    this.annotation.cursorLineAnnotation.unmount();
    return true;
  }

  removeTrace(trace: Trace) {
    const removeds = _.remove(this.traces, t => t.id === trace.id);
    if (removeds.length === 0) return false;
    trace.spans.forEach(s => this.grouping.removeSpan(s));
    this.layout();
    this.annotation.logHighlightAnnotation.unmount();
    this.annotation.spanConnectionsAnnotation.unmount();
    this.annotation.intervalHighlightAnnotation.unmount();
    this.annotation.cursorLineAnnotation.unmount();
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

    this.viewSettings.setAxis(new Axis(
      [startTimestamp, finishTimestamp],
      [
        this.viewSettings.spanBarViewportMargin,
        this.viewSettings.width - this.viewSettings.spanBarViewportMargin
      ]
    ));

    this.groupViews.forEach(v => v.dispose()); // This will unmount self, unbind all handlers,
                                               // no need to manually remove listener here
    this.groupViews = [];

    const groups = this.grouping.getAllGroups().sort((a, b) => a.startTimestamp - b.startTimestamp);
    groups.forEach((group) => {
      const groupView = new GroupView({ group, viewSettings: this.viewSettings });
      groupView.init({
        groupNamePanel: this.groupNamePanel,
        timelinePanel: this.timelinePanel,
        svgDefs: this.defs
      });
      groupView.layout();

      // Bind layout event after initial layout
      groupView.on(GroupViewEvent.LAYOUT, this.onGroupLayout.bind(this));

      this.groupViews.push(groupView);
    });

    this.updateGroupVerticalPositions();

    // Annotations
    this.annotation.updateData(this.groupViews);

    // Reset vertical panning
    this.panelTranslateY = 0;
    this.groupNamePanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.timelinePanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.annotationUnderlayPanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.annotationOverlayPanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);

    // Hide cursor line
    this.annotation.cursorLineAnnotation.unmount();
  }

  onGroupLayout() {
    this.updateGroupVerticalPositions();
  }

  updateGroupVerticalPositions() {
    const { groupPaddingTop, groupPaddingBottom, rowHeight } = this.viewSettings;
    let y = 0;

    this.groupViews.forEach((groupView, i) => {
      groupView.updatePosition({ y });
      if (groupView.options.isCollapsed) {
        y += groupPaddingTop;
      } else {
        y += groupPaddingTop + groupPaddingBottom + (groupView.heightInRows * rowHeight);
      }
    });

    this.contentHeight = y;
  }

  getContentHeight() {
    return this.contentHeight;
  }

  showOrHideLogHighlightAnnotation(options: { spanView: SpanView, logId: string } | null) {
    if (!options) return this.annotation.logHighlightAnnotation.unmount();
    this.annotation.logHighlightAnnotation.prepare({ spanView: options.spanView, logId: options.logId });
    this.annotation.logHighlightAnnotation.update();
    this.annotation.logHighlightAnnotation.mount();
  }

  updatePanelsTranslateY(offsetY: number) {
    const { height: viewportHeight } = this.viewSettings;
    if (this.getContentHeight() <= viewportHeight) return;

    const newTranslateY = this.panelTranslateY + offsetY;
    this.panelTranslateY = Math.min(Math.max(newTranslateY, viewportHeight - this.contentHeight), 0);

    this.groupNamePanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.timelinePanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.annotationUnderlayPanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.annotationOverlayPanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
  }
}
