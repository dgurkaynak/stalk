import * as _ from 'lodash';
import BaseAnnotation from './base';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface VerticalLineAnnotationSettings {
  timestamp: number,
  lineColor?: string,
  lineWidth?: number,
  position?: 'overlay' | 'underlay',
  displayTime?: boolean,
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
      displayTime: true
    });

    this.line.setAttribute('x1', '0');
    this.line.setAttribute('x2', '0');
    this.line.setAttribute('y1', '0');
    this.line.setAttribute('stroke', this.settings.lineColor!);
    this.line.setAttribute('stroke-width', this.settings.lineWidth! + '');

    this.text.textContent = '';
    this.text.setAttribute('x', '0');
    this.text.setAttribute('y', '0');

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

    const height = Math.max(this.deps.timelineView.getContentHeight(), this.deps.viewSettings.height);
    this.line.setAttribute('y2', height + '');

    const x = this.deps.viewSettings.getAxis().input2output(this.settings.timestamp);
    if (!isNaN(x)) this.line.setAttribute('transform', `translate(${x}, 0)`);
  }
}
