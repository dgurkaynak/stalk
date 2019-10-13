import * as _ from 'lodash';
import GroupView from './group-view';
import TimelineView from './view';
import TimelineViewSettings from './view-settings';
import SpanView from './span-view';
import shortid from 'shortid';


const SVG_NS = 'http://www.w3.org/2000/svg';

export default class AnnotationManager {
  private timelineView: TimelineView;
  private underlayPanel: SVGGElement;
  private overlayPanel: SVGGElement;
  private viewSettings: TimelineViewSettings;
  private groupViews: GroupView[] = [];
  private annotations: { [key: string]: BaseAnnotation } = {};
  private annotationDeps = {
    timelineView: this.timelineView,
    underlayPanel: this.underlayPanel,
    overlayPanel: this.overlayPanel,
    viewSettings: this.viewSettings,
    findSpanView : this.findSpanView.bind(this),
    findSpanViews : this.findSpanViews.bind(this)
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


export class BaseAnnotation {
  protected underlayElements: SVGElement[] = [];
  protected overlayElements: SVGElement[] = [];

  constructor(protected deps: {
    timelineView: TimelineView,
    underlayPanel: SVGGElement,
    overlayPanel: SVGGElement,
    viewSettings: TimelineViewSettings,
    findSpanView : (spanId: string | ((spanView: SpanView) => boolean)) => [GroupView?, SpanView?],
    findSpanViews : (predicate: (spanView: SpanView) => boolean) => [GroupView, SpanView][]
  }) {
    // Noop
  }

  prepare(...args: any[]): void {
    // To be implemented
  }

  mount() {
    this.underlayElements.forEach(el => this.deps.underlayPanel.appendChild(el));
    this.overlayElements.forEach(el => this.deps.overlayPanel.appendChild(el));
  }

  unmount() {
    this.underlayElements.forEach(el => el.parentElement && el.parentElement.removeChild(el));
    this.overlayElements.forEach(el => el.parentElement && el.parentElement.removeChild(el));
  }

  update(): void {
    // To be implemented
  }
}



interface LogHighlightAnnotationSettings {
  spanView: SpanView,
  logId: string,
  lineColor?: string,
  circleColor?: string,
  circleRadius?: string,
}
export class LogHighlightAnnotation extends BaseAnnotation {
  private settings?: LogHighlightAnnotationSettings;
  private logTimestamp = 0;
  private line = document.createElementNS(SVG_NS, 'line');
  private circle = document.createElementNS(SVG_NS, 'circle');

  prepare(settings: LogHighlightAnnotationSettings) {
    this.settings = _.defaults(settings, {
      lineColor: '#1890ff',
      circleColor: '#1890ff',
      circleRadius: this.deps.viewSettings.spanLogCircleRadius
    });
    const logView = settings.spanView.getLogViewById(settings.logId);
    if (!logView) return false;
    this.logTimestamp = logView.log.timestamp;

    this.line.setAttribute('x1', '0');
    this.line.setAttribute('x2', '0');
    this.line.setAttribute('y1', '0');
    const height = Math.max(this.deps.timelineView.getContentHeight(), this.deps.viewSettings.height);
    this.line.setAttribute('y2', height + '');
    this.line.setAttribute('stroke', this.settings.lineColor!);

    this.circle.setAttribute('cx', '0');
    this.circle.setAttribute('cy', '0');
    this.circle.setAttribute('r', (this.settings.circleRadius! + 1) + '');
    this.circle.setAttribute('fill', this.settings.circleColor!);

    this.overlayElements = [this.line, this.circle];
  }

  update() {
    if (!this.settings) return;
    const axis = this.deps.viewSettings.getAxis();
    const span = this.settings.spanView.span;
    const [ groupView ] = this.deps.findSpanView(span.id);
    if (!groupView) return;
    const groupViewProps = groupView.getViewPropertiesCache();
    const spanViewProps = this.settings.spanView.getViewPropertiesCache();

    const x = axis.input2output(this.logTimestamp);
    this.line.setAttribute('transform', `translate(${x}, 0)`);
    const y = groupViewProps.y + spanViewProps.y + (this.deps.viewSettings.spanBarHeight / 2);
    this.circle.setAttribute('transform', `translate(${x}, ${y})`);
  }
}
