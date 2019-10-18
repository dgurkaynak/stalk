import * as _ from 'lodash';
import BaseAnnotation from './base';
import SpanView from '../span-view';

const SVG_NS = 'http://www.w3.org/2000/svg';

enum ViewType {
  CIRCLE = 'lha_circle'
}

interface LogHighlightAnnotationSettings {
  spanView: SpanView,
  logId: string,
  lineColor?: string,
  circleColor?: string,
  circleRadius?: string,
  circleStrokeWidth?: number,
  circleStrokeColor?: string,
}
export default class LogHighlightAnnotation extends BaseAnnotation {
  static ViewType = ViewType;

  private settings?: LogHighlightAnnotationSettings;
  private logTimestamp = 0;
  private line = document.createElementNS(SVG_NS, 'line');
  private circle = document.createElementNS(SVG_NS, 'circle');

  prepare(settings: LogHighlightAnnotationSettings) {
    this.settings = _.defaults(settings, {
      lineColor: '#000',
      circleColor: '#fff',
      circleRadius: this.deps.viewSettings.spanLogCircleRadius,
      circleStrokeWidth: 2,
      circleStrokeColor: '#000'
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
    this.circle.setAttribute('stroke', this.settings.circleStrokeColor!);
    this.circle.setAttribute('stroke-width', this.settings.circleStrokeWidth! + '');
    this.circle.setAttribute('data-view-type', ViewType.CIRCLE);
    this.circle.setAttribute('data-log-id', logView.id);
    this.circle.setAttribute('data-span-id', this.settings.spanView.span.id);

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
