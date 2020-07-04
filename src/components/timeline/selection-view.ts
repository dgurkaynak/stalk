import { formatMicroseconds } from '../../utils/format-microseconds';
import Axis from './axis';
import defaultsDeep from 'lodash/defaultsDeep';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SelectionViewOptions {
  parent: SVGElement;
  axis: Axis;
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    textColor?: string;
    textSize?: number;
  };
}

export default class SelectionView {
  private options: SelectionViewOptions;
  private startPos = { x: 0, y: 0 };
  private currentPos = { x: 0, y: 0 };
  private container = document.createElementNS(SVG_NS, 'g');
  private rect = document.createElementNS(SVG_NS, 'rect');
  private durationText = document.createElementNS(SVG_NS, 'text');

  constructor(options: SelectionViewOptions) {
    this.options = defaultsDeep(options, {
      style: {
        backgroundColor: 'rgba(58, 122, 217, 0.25)',
        borderColor: '#3E7CD6',
        borderWidth: 1,
        textColor: '#3E7CD6',
        textSize: 10,
      },
    });
    this.container.appendChild(this.rect);
    this.container.appendChild(this.durationText);

    this.rect.setAttribute('fill', this.options.style.backgroundColor);
    this.rect.setAttribute('stroke', this.options.style.borderColor);
    this.rect.setAttribute('stroke-width', this.options.style.borderWidth + '');

    this.durationText.setAttribute(
      'font-size',
      this.options.style.textSize + ''
    );
    this.durationText.setAttribute('fill', this.options.style.textColor);
    this.durationText.setAttribute('text-anchor', 'middle');
  }

  mount() {
    !this.container.parentElement &&
      this.options.parent.appendChild(this.container);
  }

  unmount() {
    this.container.parentElement?.removeChild(this.container);
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

    const [startTime, finishTime] = [
      this.options.axis.output2input(x),
      this.options.axis.output2input(x + width),
    ];

    this.rect.setAttribute('x', x + '');
    this.rect.setAttribute('y', y + '');
    this.rect.setAttribute('width', width + '');
    this.rect.setAttribute('height', height + '');
    this.durationText.textContent = formatMicroseconds(finishTime - startTime);
    this.durationText.setAttribute('x', x + width / 2 + '');
    this.durationText.setAttribute('y', y + height + 14 + '');
  }

  stop() {
    const { x, y } = this.currentPos;
    return this.calculateRect(x, y);
  }
}
