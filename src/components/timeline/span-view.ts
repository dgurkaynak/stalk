import { Span } from '../../model/span';
import TimelineView from './view';
import ColorManagers from '../color/managers';


const SVG_NS = 'http://www.w3.org/2000/svg';


export default class SpanView {
  span?: Span;
  g = document.createElementNS(SVG_NS, 'g');
  rect = document.createElementNS(SVG_NS, 'rect');
  isCollapsed = false;

  constructor(private timelineView: TimelineView) {
    this.g.appendChild(this.rect);
  }

  mount(parentElement: SVGGElement) {
    parentElement.appendChild(this.g);
  }

  unmount() {
    const parentElement = this.g.parentElement;
    parentElement && parentElement.removeChild(this.g);
  }

  prepare(span: Span) {
    this.span = span;
    this.updatePositionAndSize();
    this.rect.setAttribute('fill', ColorManagers.operationName.colorFor(this.span.operationName) + '');
  }

  updatePositionAndSize() {
    const { axis, viewSettings } = this.timelineView;
    const startX = axis!.input2output(this.span!.startTime);
    this.rect.setAttribute('x', startX + '');
    this.rect.setAttribute('y', '0');
    this.rect.setAttribute('width', axis!.input2output(this.span!.finishTime) - startX + '');
    this.rect.setAttribute('height', viewSettings.singleDepthViewHeight + '');
  }
}
