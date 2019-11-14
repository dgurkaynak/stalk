import SpanView from './span-view';
import vc from './view-constants';
import prettyMilliseconds from 'pretty-ms';
import { Span } from '../../model/interfaces'


const SVG_NS = 'http://www.w3.org/2000/svg';


export default class SpanTooltipView {
  spanView: SpanView;

  private container = document.createElementNS(SVG_NS, 'g');
  private rect = document.createElementNS(SVG_NS, 'rect');
  private durationText = document.createElementNS(SVG_NS, 'text');
  private labelText = document.createElementNS(SVG_NS, 'text');
  private viewportSize = { width: 0, height: 0 };
  private labelBy: (span: Span) => string = (span) => span.operationName;
  private viewPropertiesCache = { width: 0 };

  constructor(private parentEl: SVGElement) {
    this.container.appendChild(this.rect);
    this.container.appendChild(this.durationText);
    this.container.appendChild(this.labelText);

    this.rect.setAttribute('filter', 'url(#tooltip-shadow)');
  }

  reuse(spanView: SpanView) {
    this.spanView = spanView;
    const span = spanView.span;

    this.rect.setAttribute('x', '0');
    this.rect.setAttribute('y', '0');
    this.rect.setAttribute('width', '0');
    this.rect.setAttribute('height', vc.spanTooltipHeight + '');
    this.rect.setAttribute('fill', vc.spanTooltipBackgroundColor);

    const duration = prettyMilliseconds((span.finishTime - span.startTime) / 1000, { formatSubMilliseconds: true });
    // TODO: Also calculate self-time (exluding child durations)
    this.durationText.textContent = duration;
    this.durationText.setAttribute('x', '5');
    this.durationText.setAttribute('y', '14');
    this.durationText.setAttribute('font-size', vc.spanTooltipFontSize + '');
    this.durationText.setAttribute('fill', vc.spanTooltipDurationTextColor);

    this.labelText.textContent = this.labelBy(span);
    this.labelText.setAttribute('font-size', vc.spanTooltipFontSize + '');
    this.labelText.setAttribute('font-weight', '500');
    this.labelText.setAttribute('x', '50');
    this.labelText.setAttribute('y', '14');

    this.updateInternalPositionsAndWidth();
  }

  mount() {
    this.parentEl.appendChild(this.container);
    this.updateInternalPositionsAndWidth();
  }

  unmount() {
    const parent = this.container.parentElement;
    parent && parent.removeChild(this.container);
  }

  updateSpanLabelling(labelBy: (span: Span) => string) {
    this.labelBy = labelBy;
  }

  updateViewportSize(width: number, height: number) {
    this.viewportSize = { width, height };
  }

  // This method should be executed after mount!
  updateInternalPositionsAndWidth() {
    const durationBB = this.durationText.getBBox();
    const labelX = durationBB.width + 5;
    const labelBB = this.labelText.getBBox();
    const width = 5 + labelX + 6 + labelBB.width + 5;

    this.durationText.setAttribute('x', '5');
    this.labelText.setAttribute('x', (labelX + 6) + '');
    this.rect.setAttribute('width', width + '');

    this.viewPropertiesCache.width = width;
  }

  update(mouseX: number, mouseY: number) {
    const width = this.viewPropertiesCache.width;

    const offset = 10;
    let x = 0;
    let y = 0;

    if (mouseX + offset + width <= this.viewportSize.width - 5) {
      x = mouseX + offset;
    } else {
      x = this.viewportSize.width - 5 - width;
    }

    if (mouseY + offset + vc.spanTooltipHeight <= this.viewportSize.height - 5) {
      y = mouseY + offset;
    } else {
      // Draw upper
      y = mouseY - offset - vc.spanTooltipHeight;
    }

    this.container.setAttribute('transform', `translate(${x}, ${y})`);
  }
}
