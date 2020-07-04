import defaults from 'lodash/defaults';
import BaseDecoration from './base';
import { formatMicroseconds } from '../../../utils/format-microseconds';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface VerticalLineDecorationSettings {
  timestamp: number;
  lineColor?: string;
  lineWidth?: number;
  position?: 'overlay' | 'underlay';
  displayTime?: boolean;
  timeOffsetToBottom?: number;
  timeOffsetToLine?: number;
  timeFontColor?: string;
  timeFontSize?: number;
}
export default class VerticalLineDecoration extends BaseDecoration {
  private settings: VerticalLineDecorationSettings = {
    timestamp: 0,
    lineColor: '#ccc',
    lineWidth: 1,
    position: 'underlay',
    displayTime: true,
    timeOffsetToBottom: 10,
    timeOffsetToLine: 5,
    timeFontColor: '#aaa',
    timeFontSize: 12,
  };
  private line = document.createElementNS(SVG_NS, 'line');
  private text = document.createElementNS(SVG_NS, 'text');

  prepare(settings: VerticalLineDecorationSettings) {
    this.settings = defaults(settings, this.settings);

    this.line.setAttribute('x1', '0');
    this.line.setAttribute('x2', '0');
    this.line.setAttribute('y1', '0');
    this.line.setAttribute('stroke', this.settings.lineColor);
    this.line.setAttribute('stroke-width', this.settings.lineWidth + '');

    this.text.textContent = '';
    this.text.setAttribute('x', '0');
    this.text.setAttribute('y', '0');
    this.text.setAttribute('fill', this.settings.timeFontColor);
    this.text.setAttribute('font-size', this.settings.timeFontSize + '');

    const elements = this.settings.displayTime
      ? [this.line, this.text]
      : [this.line];

    if (this.settings.position === 'overlay') {
      this.overlayElements = elements;
      this.underlayElements = [];
    } else {
      this.overlayElements = [];
      this.underlayElements = elements;
    }
  }

  setTimestampFromScreenPositionX(offsetX: number) {
    this.settings.timestamp = this.timelineView.axis.output2input(offsetX);
  }

  update() {
    if (this.settings.timestamp == 0) return;

    const timelineComputedStyles = this.timelineView.getComputedStyles();
    const height = Math.max(
      timelineComputedStyles.contentHeight,
      timelineComputedStyles.height
    );
    this.line.setAttribute('y2', height + '');

    const relativeTimeFromStart =
      (this.settings.timestamp - this.timelineView.axis.getInputRange()[0]) /
      1000;
    this.text.textContent = formatMicroseconds(relativeTimeFromStart);

    const x = this.timelineView.axis.input2output(this.settings.timestamp);

    if (!isNaN(x)) {
      const isOnLeftSide = x <= timelineComputedStyles.width / 2;
      const textX = isOnLeftSide
        ? x + this.settings.timeOffsetToLine
        : x - this.settings.timeOffsetToLine;
      this.line.setAttribute('transform', `translate(${x}, 0)`);
      const textY =
        timelineComputedStyles.height -
        this.settings.timeOffsetToBottom -
        timelineComputedStyles.panelTranslateY;
      this.text.setAttribute('transform', `translate(${textX}, ${textY})`);
      this.text.setAttribute('text-anchor', isOnLeftSide ? 'start' : 'end');
    }
  }
}
