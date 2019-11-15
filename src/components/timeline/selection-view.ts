import vc from './view-constants';
import prettyMilliseconds from 'pretty-ms';
import Axis from './axis';

const SVG_NS = 'http://www.w3.org/2000/svg';


export default class SelectionView {
  private startPos = { x: 0, y: 0 };
  private currentPos = { x: 0, y: 0 };
  private container = document.createElementNS(SVG_NS, 'g');
  private rect = document.createElementNS(SVG_NS, 'rect');
  private durationText = document.createElementNS(SVG_NS, 'text');

  constructor(private deps: {
    parentEl: SVGElement,
    axis: Axis
  }) {
    this.container.appendChild(this.rect);
    this.container.appendChild(this.durationText);

    this.rect.setAttribute('fill', vc.selectionBackgroundColor);
    this.rect.setAttribute('stroke', vc.selectionBorderColor);
    this.rect.setAttribute('stroke-width', vc.selectionBorderWidth + '');

    this.durationText.setAttribute('font-size', vc.selectionTextSize + '');
    this.durationText.setAttribute('fill', vc.selectionTextColor);
    this.durationText.setAttribute('text-anchor', 'middle');
  }

  mount() {
    !this.container.parentElement && this.deps.parentEl.appendChild(this.container);
  }

  unmount() {
    this.container.parentElement && this.container.parentElement.removeChild(this.container);
  }

  start(x: number, y: number) {
    this.startPos = { x, y };
  }

  /**
   * Calculates the rect (x, y, width, height)
   */
  private calculateRect(x: number, y: number) {
    const xLeft = Math.min(x, this.startPos.x);
    const yTop = Math.min(y, this.startPos.y);
    const xRight = Math.max(x, this.startPos.x);
    const yBottom = Math.max(y, this.startPos.y);
    const width = xRight - xLeft;
    const height = yBottom - yTop;

    return { x: xLeft, y: yTop, width, height };
  }

  update(mouseX: number, mouseY: number) {
    this.currentPos = { x: mouseX, y: mouseY };
    const { x, y, width, height } = this.calculateRect(mouseX, mouseY);

    const [ startTime, finishTime ] = [
      this.deps.axis.output2input(x),
      this.deps.axis.output2input(x + width)
    ];

    this.rect.setAttribute('x', x + '');
    this.rect.setAttribute('y', y + '');
    this.rect.setAttribute('width', width + '');
    this.rect.setAttribute('height', height + '');
    this.durationText.textContent = prettyMilliseconds((finishTime - startTime) / 1000, { formatSubMilliseconds: false });
    this.durationText.setAttribute('x', (x + (width / 2)) + '');
    this.durationText.setAttribute('y', (y + height + 14) + '');
  }

  stop() {
    const { x, y } = this.currentPos;
    return this.calculateRect(x, y);
  }
}
