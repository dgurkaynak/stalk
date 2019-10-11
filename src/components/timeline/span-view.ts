import { Span } from '../../model/span';
import ViewSettings from './view-settings';
import ColorManagers from '../color/managers';


const SVG_NS = 'http://www.w3.org/2000/svg';


export default class SpanView {
  span?: Span;
  viewSettings: ViewSettings;
  options = {
    isCollapsed: false
  };

  private g = document.createElementNS(SVG_NS, 'g');
  private rect = document.createElementNS(SVG_NS, 'rect');
  private widthInPx = 0;

  constructor(options: {
    viewSettings: ViewSettings
  }) {
    this.viewSettings = options.viewSettings;
    this.rect.setAttribute('x', '0');
    this.rect.setAttribute('y', '0');
    this.g.appendChild(this.rect);
  }

  mount(parentElement: SVGGElement) {
    parentElement.appendChild(this.g);
  }

  unmount() {
    const parentElement = this.g.parentElement;
    parentElement && parentElement.removeChild(this.g);
  }

  reuse(span: Span) {
    this.span = span;
    this.rect.setAttribute('fill', ColorManagers.operationName.colorFor(this.span.operationName) + '');
    this.rect.setAttribute('rx', this.viewSettings.barRadius + '');
    this.rect.setAttribute('ry', this.viewSettings.barRadius + '');
  }

  updatePosition(options: {
    rowIndex: number
  }) {
    if (!this.span) return false;

    const { axis, barHeight, barSpacing } = this.viewSettings;
    const startX = axis.input2output(this.span.startTime);
    this.widthInPx = axis.input2output(this.span.finishTime) - startX;
    this.rect.setAttribute('width',  this.widthInPx + '');
    this.rect.setAttribute('height', barHeight + '');
    const startY = (options.rowIndex * (barHeight + (2 * barSpacing))) + barSpacing;
    this.g.setAttribute('transform', `translate(${startX}, ${startY})`);
  }
}
