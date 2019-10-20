import * as _ from 'lodash';
import BaseAnnotation from './base';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface VerticalLineAnnotationSettings {
  timestamp: number | null,
  lineColor?: string,
  lineWidth?: number,
  position?: 'overlay' | 'underlay',
  displayTime?: boolean,
  timeOffsetToBottom?: number,
  timeOffsetToLine?: number,
  timeFontColor?: string,
  timeFontSize?: number,
}
export default class VerticalLineAnnotation extends BaseAnnotation {
  private settings?: VerticalLineAnnotationSettings;
  private line = document.createElementNS(SVG_NS, 'line');
  private text = document.createElementNS(SVG_NS, 'text');

  prepare(settings: VerticalLineAnnotationSettings) {
    this.settings = _.defaults(settings, {
      lineColor: '#ccc',
      lineWidth: 1,
      position: 'underlay',
      displayTime: false,
      timeOffsetToBottom: 10,
      timeOffsetToLine: 5,
      timeFontColor: '#aaa',
      timeFontSize: 12,
    });

    this.line.setAttribute('x1', '0');
    this.line.setAttribute('x2', '0');
    this.line.setAttribute('y1', '0');
    this.line.setAttribute('stroke', this.settings.lineColor!);
    this.line.setAttribute('stroke-width', this.settings.lineWidth! + '');

    this.text.textContent = '';
    this.text.setAttribute('x', '0');
    this.text.setAttribute('y', '0');
    this.text.setAttribute('fill', this.settings.timeFontColor!);
    this.text.setAttribute('font-size', this.settings.timeFontSize! + '');

    const elements = this.settings.displayTime ? [this.line, this.text] : [this.line];

    if (this.settings.position === 'overlay') {
        this.overlayElements = elements;
        this.underlayElements = [];
    } else {
        this.overlayElements = [];
        this.underlayElements = elements;
    }
  }

  setTimestampFromScreenPositionX(offsetX: number) {
    if (!this.settings) return;
    this.settings.timestamp = this.deps.viewSettings.getAxis().output2input(offsetX);
  }

  update() {
    if (!this.settings) return;
    if (!this.settings.timestamp) return;

    const height = Math.max(this.deps.timelineView.getContentHeight(), this.deps.viewSettings.height);
    this.line.setAttribute('y2', height + '');
    // TODO: Are you sure it's always in nanoseconds, for both zipkin & jaeger?
    this.text.textContent = new Date(this.settings.timestamp / 1000).toString();

    const x = this.deps.viewSettings.getAxis().input2output(this.settings.timestamp);

    if (!isNaN(x)) {
      const isOnLeftSide = x <= this.deps.viewSettings.width / 2;
      const textX = isOnLeftSide ? x + this.settings.timeOffsetToLine! : x - this.settings.timeOffsetToLine!;
      this.line.setAttribute('transform', `translate(${x}, 0)`);
      this.text.setAttribute('transform', `translate(${textX}, ${this.deps.viewSettings.height - this.settings.timeOffsetToBottom!})`);
      this.text.setAttribute('text-anchor', isOnLeftSide ? 'start' : 'end');
    }

  }
}
