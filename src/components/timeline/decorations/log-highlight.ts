import defaults from 'lodash/defaults';
import BaseDecoration from './base';
import { SpanGroupView } from '../span-group-view';
import { SpanView } from '../span-view';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface LogHighlightDecorationSettings {
  spanId: string;
  logId: string;
  lineColor?: string;
  lineDashArray?: string;
  circleColor?: string;
  circleRadius?: number;
  circleStrokeWidth?: number;
  circleStrokeColor?: string;
}

export default class LogHighlightDecoration extends BaseDecoration {
  private settings: LogHighlightDecorationSettings = {
    spanId: '',
    logId: '',
    lineColor: '#000',
    lineDashArray: '0',
    circleColor: '#fff',
    circleRadius: 2,
    circleStrokeWidth: 2,
    circleStrokeColor: '#000'
  };
  private logTimestamp = 0;
  private groupView: SpanGroupView;
  private spanView: SpanView;

  private line = document.createElementNS(SVG_NS, 'line');
  private circle = document.createElementNS(SVG_NS, 'circle');

  prepare(settings: LogHighlightDecorationSettings) {
    this.settings = defaults(settings, this.settings);

    this.spanView = null;
    this.groupView = null;
    const [groupView, spanView] = this.timelineView.findSpanView(
      settings.spanId
    );
    if (!groupView || !spanView) return false; // this will force timelineview to unmount this decoration
    const logView = spanView.getLogViewById(settings.logId);
    if (!logView) return false; // this will force timelineview to unmount this decoration
    this.groupView = groupView;
    this.spanView = spanView;
    this.logTimestamp = logView.log.timestamp;

    this.line.setAttribute('x1', '0');
    this.line.setAttribute('x2', '0');
    this.line.setAttribute('y1', '0');
    const height = Math.max(
      this.timelineView.contentHeight,
      this.timelineView.height
    );
    this.line.setAttribute('y2', height + '');
    this.line.setAttribute('stroke', this.settings.lineColor);
    this.line.setAttribute('stroke-dasharray', this.settings.lineDashArray);

    this.circle.setAttribute('cx', '0');
    this.circle.setAttribute('cy', '0');
    this.circle.setAttribute('r', this.settings.circleRadius + 1 + '');
    this.circle.setAttribute('fill', this.settings.circleColor);
    this.circle.setAttribute('stroke', this.settings.circleStrokeColor);
    this.circle.setAttribute(
      'stroke-width',
      this.settings.circleStrokeWidth + ''
    );

    this.overlayElements = [this.line, this.circle];
  }

  update() {
    if (!this.spanView || !this.groupView) return;

    const groupViewProps = this.groupView.getComputedStyles();
    const spanStyles = this.spanView.getComputedStyles();

    const x = this.timelineView.axis.input2output(this.logTimestamp);
    this.line.setAttribute('transform', `translate(${x}, 0)`);
    const y = groupViewProps.y + spanStyles.y + spanStyles.barHeight / 2;
    this.circle.setAttribute('transform', `translate(${x}, ${y})`);
  }
}
