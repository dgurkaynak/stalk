import SpanView from './span-view';
import vc from './view-constants';
import prettyMilliseconds from 'pretty-ms';
import { Span } from '../../model/interfaces';
import Axis from './axis';


const SVG_NS = 'http://www.w3.org/2000/svg';


export default class SpanTooltipView {
  spanView: SpanView;

  private clipPath = document.createElementNS(SVG_NS, 'clipPath');
  private clipPathRect = document.createElementNS(SVG_NS, 'rect');

  private container = document.createElementNS(SVG_NS, 'g');
  private bodyContainer = document.createElementNS(SVG_NS, 'g');
  private rect = document.createElementNS(SVG_NS, 'rect');
  private durationText = document.createElementNS(SVG_NS, 'text');
  private labelText = document.createElementNS(SVG_NS, 'text');
  private summaryText = document.createElementNS(SVG_NS, 'text');
  private viewportSize = { width: 0, height: 0 };
  private labelBy: (span: Span) => string = (span) => span.operationName;
  private viewPropertiesCache = { headerWidth: 0, width: 0, nearbyLogsCacheId: '' };
  private logContainers: SVGGElement[] = [];
  private logTimeTexts: SVGTextElement[] = [];
  private logFieldsTexts: SVGTextElement[] = [];
  private logSeperatorLines: SVGLineElement[] = [];

  constructor(private deps: {
    parentEl: SVGElement,
    defsEl: SVGDefsElement,
    axis: Axis
  }) {
    this.clipPath.id = 'tooltip-clip-path';
    this.clipPathRect.setAttribute('x', `0`);
    this.clipPathRect.setAttribute('y', `0`);
    this.clipPath.appendChild(this.clipPathRect);

    this.container.appendChild(this.rect);

    this.bodyContainer.appendChild(this.durationText);
    this.bodyContainer.appendChild(this.labelText);
    this.bodyContainer.appendChild(this.summaryText);
    this.bodyContainer.setAttribute('clip-path', 'url(#tooltip-clip-path)');
    this.container.appendChild(this.bodyContainer);

    this.rect.setAttribute('filter', 'url(#tooltip-shadow)');
  }

  reuse(spanView: SpanView) {
    this.spanView = spanView;
    const span = spanView.span;

    this.rect.setAttribute('x', '0');
    this.rect.setAttribute('y', '0');
    this.rect.setAttribute('width', '0');
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

    this.summaryText.textContent = `${Object.keys(span.tags).length} tag(s), ${span.logs.length} log(s)`;
    this.summaryText.setAttribute('font-size', vc.spanTooltipFontSize + '');
    this.summaryText.setAttribute('font-style', 'italic');
    this.summaryText.setAttribute('x', '100');
    this.summaryText.setAttribute('y', '14');

    this.updateHeaderPositionsAndWidth();
  }

  mount() {
    this.deps.defsEl.appendChild(this.clipPath);
    this.deps.parentEl.appendChild(this.container);
    this.updateHeaderPositionsAndWidth();
  }

  unmount() {
    const parent = this.container.parentElement;
    parent && parent.removeChild(this.container);

    const parent2 = this.clipPath.parentElement;
    parent2 && parent2.removeChild(this.clipPath);
  }

  updateSpanLabelling(labelBy: (span: Span) => string) {
    this.labelBy = labelBy;
  }

  updateViewportSize(width: number, height: number) {
    this.viewportSize = { width, height };
  }

  // This method should be executed after mount!
  updateHeaderPositionsAndWidth() {
    const durationBB = this.durationText.getBBox();
    const labelX = 5 + durationBB.width + 6;
    const labelBB = this.labelText.getBBox();
    const summaryX = labelX + labelBB.width + 6;
    const summaryBB = this.summaryText.getBBox();
    const width = summaryX + summaryBB.width + 5;

    this.durationText.setAttribute('x', '5');
    this.labelText.setAttribute('x', (labelX) + '');
    this.summaryText.setAttribute('x', (summaryX) + '');
    this.rect.setAttribute('width', width + '');

    this.viewPropertiesCache.headerWidth = width;
  }

  update(mouseX: number, mouseY: number) {
    // TODO: Not sure about this early terminations
    if (!this.container.parentElement) return;
    if (!this.spanView) return;

    let width = this.viewPropertiesCache.headerWidth;
    let height = vc.spanTooltipLineHeight;

    // Logs stuff
    const previousLogsCacheId = this.viewPropertiesCache.nearbyLogsCacheId;
    const nearbyLogViews = this.spanView.getNearbyLogViews(mouseX);
    const nearbyLogsCacheId = nearbyLogViews.map(l => l.id).join('');
    this.viewPropertiesCache.nearbyLogsCacheId = nearbyLogsCacheId;

    // If logs are changed
    if (nearbyLogsCacheId != previousLogsCacheId) {
      // Unmount previous ones
      this.logContainers.forEach(g => g.parentElement && g.parentElement.removeChild(g));
      this.logContainers = [];
      this.logTimeTexts = [];
      this.logFieldsTexts = [];
      this.logSeperatorLines = [];

      nearbyLogViews.forEach((l) => {
        const logContainer = document.createElementNS(SVG_NS, 'g');
        const logTimeText = document.createElementNS(SVG_NS, 'text');
        const logFieldsText = document.createElementNS(SVG_NS, 'text');
        const logSeperatorLine = document.createElementNS(SVG_NS, 'line');

        logContainer.setAttribute('transform', `translate(0, ${height})`);
        this.bodyContainer.appendChild(logContainer);

        logSeperatorLine.setAttribute('x1', '0');
        logSeperatorLine.setAttribute('y1', '0');
        logSeperatorLine.setAttribute('x2', width + '');
        logSeperatorLine.setAttribute('y2', '0');
        logSeperatorLine.setAttribute('stroke', '#cccccc');
        logSeperatorLine.setAttribute('stroke-width', '1');
        logContainer.appendChild(logSeperatorLine);

        const time = prettyMilliseconds((l.log.timestamp - this.deps.axis.getInputRange()[0]) / 1000, { formatSubMilliseconds: true });
        logTimeText.textContent = `Log @ ${time}`;
        logTimeText.setAttribute('x', '5');
        logTimeText.setAttribute('y', '14');
        logTimeText.setAttribute('font-size', vc.spanTooltipFontSize + '');
        logTimeText.setAttribute('fill', '#eba134');
        logContainer.appendChild(logTimeText);

        logFieldsText.textContent = JSON.stringify(l.log.fields);
        logFieldsText.setAttribute('x', '5');
        logFieldsText.setAttribute('y', '28');
        logFieldsText.setAttribute('font-size', vc.spanTooltipFontSize + '');
        logFieldsText.setAttribute('fill', '#000000');
        logContainer.appendChild(logFieldsText);

        this.logContainers.push(logContainer);
        this.logTimeTexts.push(logTimeText);
        this.logFieldsTexts.push(logFieldsText);
        this.logSeperatorLines.push(logSeperatorLine);
        height += vc.spanTooltipLineHeight + 14;

      });

    } else {
      // If logs are not changed, we dont know the height, estimate it like above
      height = vc.spanTooltipLineHeight + this.logContainers.length * (vc.spanTooltipLineHeight + 15);
    }

    // If any log exists, try to maximize tooltip width
    const maxWidth = this.logFieldsTexts.length > 0 ? Math.max(
      ...this.logFieldsTexts.map(t => t.getBBox().width + 5 + 5),
      width
    ) : width;
    const newWidth = Math.min(maxWidth, vc.spanTooltipMaxWidth);

    // Width is changed, perform an update to already rendered things
    if (width != newWidth) {
      width = newWidth;
      this.viewPropertiesCache.width = newWidth;

      this.rect.setAttribute('width', newWidth + '');
      this.logSeperatorLines.forEach(l => l.setAttribute('x2', width + ''));
      this.clipPathRect.setAttribute('width', `${width}`);
    }

    const offset = 10;
    let x = 0;
    let y = 0;

    if (mouseX + offset + width <= this.viewportSize.width - 5) {
      x = mouseX + offset;
    } else {
      x = this.viewportSize.width - 5 - width;
    }

    if (mouseY + offset + height <= this.viewportSize.height - 5) {
      y = mouseY + offset;
    } else {
      // Draw upper
      y = mouseY - offset - height;
    }

    this.clipPathRect.setAttribute('width', `${width}`);
    this.clipPathRect.setAttribute('height', `${height}`);
    this.rect.setAttribute('height', height + '');
    this.container.setAttribute('transform', `translate(${x}, ${y})`);
  }

}
