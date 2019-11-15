import vc from './view-constants';
import prettyMilliseconds from 'pretty-ms';
import Axis from './axis';

const SVG_NS = 'http://www.w3.org/2000/svg';


export default class SelectionView {
  private startPos = { x: 0, y: 0 };
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

  update(mouseX: number, mouseY: number) {
    const xLeft = Math.min(mouseX, this.startPos.x);
    const yTop = Math.min(mouseY, this.startPos.y);
    const xRight = Math.max(mouseX, this.startPos.x);
    const yBottom = Math.max(mouseY, this.startPos.y);
    const width = xRight - xLeft;
    const height = yBottom - yTop;

    const [ startTime, finishTime ] = [
      this.deps.axis.output2input(xLeft),
      this.deps.axis.output2input(xRight)
    ];

    this.rect.setAttribute('x', xLeft + '');
    this.rect.setAttribute('y', yTop + '');
    this.rect.setAttribute('width', width + '');
    this.rect.setAttribute('height', height + '');
    this.durationText.textContent = prettyMilliseconds((finishTime - startTime) / 1000, { formatSubMilliseconds: false });
    this.durationText.setAttribute('x', (xLeft + (width / 2)) + '');
    this.durationText.setAttribute('y', (yBottom + 14) + '');
  }
}
