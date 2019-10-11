import { Span } from '../../model/span';
import ViewSettings from './view-settings';
import ColorManagers from '../color/managers';


const SVG_NS = 'http://www.w3.org/2000/svg';


export default class SpanView {
  span?: Span;
  viewSettings: ViewSettings;
  g = document.createElementNS(SVG_NS, 'g');
  rect = document.createElementNS(SVG_NS, 'rect');
  options = {
    isCollapsed: false
  };

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
}
