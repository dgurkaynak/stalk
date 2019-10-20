import * as _ from 'lodash';
import GroupView from '../group-view';
import TimelineView from '../view';
import TimelineViewSettings from '../view-settings';
import { AxisEvent } from '../axis';
import SpanView from '../span-view';
import shortid from 'shortid';
import BaseAnnotation from './base';
import LogHighlightAnnotation from './log-highlight';
import SpanConnectionsAnnotation from './span-connections';
import VerticalLineAnnotation from './vertical-line';
import IntervalHighlightAnnotation from './interval-highlight';


export default class AnnotationManager {
  private timelineView: TimelineView;
  private underlayPanel: SVGGElement;
  private overlayPanel: SVGGElement;
  private viewSettings: TimelineViewSettings;
  private groupViews: GroupView[] = [];
  private annotations: { [key: string]: BaseAnnotation } = {};
  private annotationDeps: {
    timelineView: TimelineView,
    underlayPanel: SVGGElement,
    overlayPanel: SVGGElement,
    viewSettings: TimelineViewSettings,
    findSpanView : (spanId: string | ((spanView: SpanView) => boolean)) => [GroupView?, SpanView?],
    findSpanViews : (predicate: (spanView: SpanView) => boolean) => [GroupView, SpanView][]
  };

  logHighlightAnnotation: LogHighlightAnnotation;
  spanConnectionsAnnotation: SpanConnectionsAnnotation;
  cursorLineAnnotation: VerticalLineAnnotation;
  intervalHighlightAnnotation: IntervalHighlightAnnotation;

  private binded = {
    updateAllAnnotations: _.throttle(this.updateAllAnnotations.bind(this), 10)
  };

  constructor(options: {
    timelineView: TimelineView,
    underlayPanel: SVGGElement,
    overlayPanel: SVGGElement,
    viewSettings: TimelineViewSettings,
  }) {
    this.timelineView = options.timelineView;
    this.underlayPanel = options.underlayPanel;
    this.overlayPanel = options.overlayPanel;
    this.viewSettings = options.viewSettings;

    this.annotationDeps = {
      timelineView: this.timelineView,
      underlayPanel: this.underlayPanel,
      overlayPanel: this.overlayPanel,
      viewSettings: this.viewSettings,
      findSpanView : this.findSpanView.bind(this),
      findSpanViews : this.findSpanViews.bind(this)
    };

    // Do not forget to add these to `.updateAllAnnotations()` method
    this.logHighlightAnnotation = new LogHighlightAnnotation(this.annotationDeps);
    this.spanConnectionsAnnotation = new SpanConnectionsAnnotation(this.annotationDeps);
    this.cursorLineAnnotation = new VerticalLineAnnotation(this.annotationDeps);
    this.intervalHighlightAnnotation = new IntervalHighlightAnnotation(this.annotationDeps);

    options.viewSettings.on(AxisEvent.TRANSLATED, this.binded.updateAllAnnotations);
    options.viewSettings.on(AxisEvent.ZOOMED, this.binded.updateAllAnnotations);
    options.viewSettings.on(AxisEvent.UPDATED, this.binded.updateAllAnnotations);
  }

  dispose() {
    this.viewSettings.removeListener(AxisEvent.TRANSLATED, [ this.binded.updateAllAnnotations ] as any);
    this.viewSettings.removeListener(AxisEvent.ZOOMED, [ this.binded.updateAllAnnotations ] as any);
    this.viewSettings.removeListener(AxisEvent.UPDATED, [ this.binded.updateAllAnnotations ] as any);
  }

  updateData(groupViews: GroupView[]) {
    this.clear();
    this.groupViews = groupViews;
  }

  clear(annotationId?: string) {
    if (annotationId) {
      const annotation = this.annotations[annotationId];
      if (!annotation) return false;
      annotation.unmount();
      return true;
    } else {
      _.forEach(this.annotations, a => a.unmount());
      this.annotations = {};
      return true;
    }
  }

  createLogHighlightAnnotation(spanView: SpanView, logId: string) {
    const annotation = new LogHighlightAnnotation(this.annotationDeps);
    annotation.prepare({ spanView, logId });
    const annotationId = shortid.generate();
    this.annotations[annotationId] = annotation;
    return annotation;
  }

  updateAllAnnotations() {
    setTimeout(() => {
      _.forEach([
        this.logHighlightAnnotation,
        this.spanConnectionsAnnotation,
        // this.cursorVerticalLineAnnotation, // TimelineView manually updates it
        this.intervalHighlightAnnotation,
      ], a => a.update());
      _.forEach(this.annotations, a => a.update());
    }, 0);
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
}

