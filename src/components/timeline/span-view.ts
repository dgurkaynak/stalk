import { Span, SpanLog } from '../../model/span';
import ViewSettings from './view-settings';
import ColorManagers from '../color/managers';
import invert from 'invert-color';
import * as shortid from 'shortid';


const SVG_NS = 'http://www.w3.org/2000/svg';

interface SpanLogViewObject {
  id: string,
  circle: SVGCircleElement,
  log: SpanLog
}


export default class SpanView {
  span: Span;
  private viewSettings: ViewSettings;
  options = {
    isCollapsed: false
  };

  private container = document.createElementNS(SVG_NS, 'g');
  private barRect = document.createElementNS(SVG_NS, 'rect');
  private labelText = document.createElementNS(SVG_NS, 'text');
  private clipPath = document.createElementNS(SVG_NS, 'clipPath');
  private clipPathRect = document.createElementNS(SVG_NS, 'rect');
  private logViews: SpanLogViewObject[] = [];

  private viewPropertiesCache = {
    width: 0,
    x: 0,
    y: 0,
  };

  constructor(options: {
    span: Span,
    viewSettings: ViewSettings
  }) {
    this.span = options.span;
    this.viewSettings = options.viewSettings;

    this.container.style.cursor = 'pointer';
    this.labelText.style.cursor = 'pointer';

    this.barRect.setAttribute('x', '0');
    this.barRect.setAttribute('y', '0');
    this.barRect.setAttribute('rx', this.viewSettings.spanBarRadius + '');
    this.barRect.setAttribute('ry', this.viewSettings.spanBarRadius + '');
    this.container.appendChild(this.barRect);

    this.labelText.setAttribute('x', '0');
    this.labelText.setAttribute('y', '0');
    this.labelText.setAttribute('font-size', this.viewSettings.spanLabelFontSize + '');

    this.clipPathRect.setAttribute('rx', this.viewSettings.spanBarRadius + '');
    this.clipPathRect.setAttribute('ry', this.viewSettings.spanBarRadius + '');
    this.clipPath.appendChild(this.clipPathRect);
  }

  mount(options: {
    groupContainer: SVGGElement,
    svgDefs: SVGDefsElement
  }) {
    options.groupContainer.appendChild(this.container);
    options.svgDefs.appendChild(this.clipPath);
  }

  unmount() {
    const parent1 = this.container.parentElement;
    parent1 && parent1.removeChild(this.container);

    const parent2 = this.clipPath.parentElement;
    parent2 && parent2.removeChild(this.clipPath);
  }

  reuse(span: Span) {
    this.span = span;
    this.updateColoring();
    this.updateLabelText();
    this.hideLabel();

    this.container.setAttribute('data-span-id', span.id);
    this.clipPath.id = `clip-path-span-${span.id}`;
    this.labelText.setAttribute('clip-path', `url(#${this.clipPath.id})`);

    this.hideLogs();
  }

  dispose() {
    this.unmount();
  }

  updateLabelText() {
    this.labelText.textContent = this.span.operationName;
  }

  updateColoring() {
    const barColor = ColorManagers.operationName.colorFor(this.span.operationName) as string;
    this.barRect.setAttribute('fill', barColor);
    this.labelText.setAttribute('fill', invert(barColor, true));
  }

  updateLabelTextDecoration() {
    this.labelText.setAttribute('text-decoration', this.options.isCollapsed ? 'underline': '');
  }

  updateVerticalPosition(rowIndex: number, dontApplyTransform = false) {
    const { spanBarSpacing, rowHeight, groupPaddingTop } = this.viewSettings;
    const { x } = this.viewPropertiesCache;
    const y = groupPaddingTop + (rowIndex * rowHeight) + spanBarSpacing; // Relative y in pixels to group container
    this.viewPropertiesCache.y = y;
    !dontApplyTransform && this.container.setAttribute('transform', `translate(${x}, ${y})`);
  }

  updateHorizontalPosition() {
    const { axis } = this.viewSettings;
    const { y } = this.viewPropertiesCache;
    const x = axis.input2output(this.span.startTime);
    this.viewPropertiesCache.x = x;
    this.container.setAttribute('transform', `translate(${x}, ${y})`);

    // Snap the label text to left of the screen
    if (x < 0) {
      this.labelText.setAttribute('x', (-x + this.viewSettings.spanLabelOffsetLeft) + '');
    } else {
      this.labelText.setAttribute('x', this.viewSettings.spanLabelOffsetLeft + '');
    }

    // Update logs
    this.logViews.forEach((logView) => {
      const logX = axis.input2output(logView.log.timestamp) - x;
      logView.circle.setAttribute('cx', logX + '');
    });
  }

  updateWidth() {
    const { axis, spanBarMinWidth } = this.viewSettings;
    const startX = axis.input2output(this.span.startTime);
    const width = Math.max(axis.input2output(this.span.finishTime) - startX, spanBarMinWidth);
    this.viewPropertiesCache.width = width;
    this.barRect.setAttribute('width',  width + '');
    this.clipPathRect.setAttribute('width',  width + '');
  }

  updateHeight() {
    const {
      spanBarHeight,
      spanBarSpacing,
      spanLabelOffsetLeft,
      spanLabelOffsetTop,
    } = this.viewSettings;

    // Update bar height
    this.barRect.setAttribute('height', spanBarHeight + '');
    this.clipPathRect.setAttribute('height', spanBarHeight + '');

    // Update label text positioning
    this.labelText.setAttribute('x', spanLabelOffsetLeft + '');
    this.labelText.setAttribute('y', (spanBarHeight / 2 + spanBarSpacing + spanLabelOffsetTop) + '');
  }

  showLabel() {
    if (!this.labelText.parentElement) this.container.appendChild(this.labelText);
  }

  hideLabel() {
    if (this.labelText.parentElement) this.container.removeChild(this.labelText);
  }

  showLogs() {
    const { spanBarHeight, spanLogCircleRadius } = this.viewSettings;
    const centerY = spanBarHeight / 2;
    this.logViews = this.span.logs.map((log) => {
      const id = shortid.generate();
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('r', spanLogCircleRadius + '');
      circle.setAttribute('cy', centerY + '');
      circle.setAttribute('fill', '#fff');
      circle.setAttribute('stroke', '#000');
      circle.setAttribute('stroke-width', '1');
      circle.setAttribute('clip-path', `url(#${this.clipPath.id})`);
      circle.setAttribute('data-log-id', id);
      this.container.appendChild(circle);
      return { id, log, circle };
    });
  }

  hideLogs() {
    this.logViews.forEach(l => this.container.removeChild(l.circle));
    this.logViews = [];
  }

  getLogViews() {
    return this.logViews;
  }
}
