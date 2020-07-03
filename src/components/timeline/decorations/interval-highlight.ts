import defaults from 'lodash/defaults';
import BaseDecoration from './base';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface IntervalHighlightDecorationSettings {
  startTimestamp: number;
  finishTimestamp: number;
  lineColor?: string;
  lineWidth?: number;
  lineDashArray?: string;
  fillColor?: string;
}
export default class IntervalHighlightDecoration extends BaseDecoration {
  private settings: IntervalHighlightDecorationSettings = {
    startTimestamp: 0,
    finishTimestamp: 0,
    lineColor: '#000',
    lineWidth: 1,
    lineDashArray: '2',
    fillColor: 'transparent'
  };
  private lineLeft = document.createElementNS(SVG_NS, 'line');
  private lineRight = document.createElementNS(SVG_NS, 'line');
  private rect = document.createElementNS(SVG_NS, 'rect');

  prepare(settings: IntervalHighlightDecorationSettings) {
    this.settings = defaults(settings, this.settings);

    [this.lineLeft, this.lineRight].forEach(line => {
      line.setAttribute('x1', '0');
      line.setAttribute('x2', '0');
      line.setAttribute('y1', '0');
      line.setAttribute('stroke', this.settings.lineColor);
      line.setAttribute('stroke-width', this.settings.lineWidth + '');
      line.setAttribute('stroke-dasharray', this.settings.lineDashArray);
    });

    this.rect.setAttribute('x', '0');
    this.rect.setAttribute('y', '0');
    this.rect.setAttribute('fill', this.settings.fillColor);

    this.underlayElements = [this.rect, this.lineLeft, this.lineRight];
  }

  update() {
    const timelineComputedStyles = this.timelineView.getComputedStyles();
    const height = Math.max(
      timelineComputedStyles.contentHeight,
      timelineComputedStyles.height
    );
    this.rect.setAttribute('height', height + '');
    this.lineLeft.setAttribute('y2', height + '');
    this.lineRight.setAttribute('y2', height + '');

    const xStart = this.timelineView.axis.input2output(
      this.settings.startTimestamp
    );
    const xFinish = this.timelineView.axis.input2output(
      this.settings.finishTimestamp
    );

    if (isNaN(xStart) || isNaN(xFinish)) return;

    this.rect.setAttribute('width', xFinish - xStart + '');
    this.rect.setAttribute('transform', `translate(${xStart}, 0)`);
    this.lineLeft.setAttribute('transform', `translate(${xStart}, 0)`);
    this.lineRight.setAttribute('transform', `translate(${xFinish}, 0)`);
  }
}
