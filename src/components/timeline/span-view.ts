import * as _ from 'lodash';
import { Span, SpanLog } from '../../model/span';
import ViewSettings from './view-settings';
import * as shortid from 'shortid';
import { getSpanColors } from '../color/helper';
import { TimelineInteractableElementAttribute, TimelineInteractableElementType } from './interaction';



const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SpanLogViewObject {
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
    barColor: '',
    labelColor: '',
    borderColor: ''
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
    // this.labelText.setAttribute('font-weight', '600');

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

    this.viewPropertiesCache.barColor = this.viewSettings.spanColorFor(span);
    const { textColor, borderColor } = getSpanColors(this.viewPropertiesCache.barColor);
    this.viewPropertiesCache.labelColor = textColor;
    this.viewPropertiesCache.borderColor = borderColor;

    this.updateColorStyle('normal');
    this.updateLabelText();
    this.hideLabel();

    this.container.setAttribute(TimelineInteractableElementAttribute, TimelineInteractableElementType.SPAN_VIEW_CONTAINER);
    this.container.setAttribute('data-span-id', span.id);
    this.clipPath.id = `clip-path-span-${span.id}`;
    this.labelText.setAttribute('clip-path', `url(#${this.clipPath.id})`);
    this.barRect.removeAttribute('filter');

    this.hideLogs();
  }

  dispose() {
    this.unmount();
  }

  updateLabelText() {
    this.labelText.textContent = this.span.operationName;
  }

  updateColorStyle(style: 'normal' | 'hover' | 'selected') {
    let barColor = this.viewPropertiesCache.barColor;
    let labelTextColor = this.viewPropertiesCache.labelColor;
    let strokeWidth = 0;
    let strokeColor = 'transparent';
    let filter = '';

    if (style === 'hover') {
      strokeWidth = 2;
      strokeColor = this.viewPropertiesCache.borderColor;
      filter = '';
    } else if (style === 'selected') {
      strokeWidth = 2;
      strokeColor = this.viewPropertiesCache.borderColor;
      filter = 'url(#span-shadow)';
    }

    this.barRect.setAttribute('fill', barColor);
    this.barRect.setAttribute('stroke-width', strokeWidth + '');
    this.barRect.setAttribute('stroke', strokeColor);
    filter ? this.barRect.setAttribute('filter', filter) : this.barRect.removeAttribute('filter');
    this.labelText.setAttribute('fill', labelTextColor);
  }

  updateLogStyle(logId: string, style: 'normal' | 'hover') {
    const logView = _.find(this.logViews, v => v.id === logId);
    if (!logView) return false;

    let fillColor = '#fff';
    let strokeWidth = 1;
    let strokeColor = '#000';
    if (style === 'hover') {
      fillColor = '#000';
      strokeWidth = 2;
      strokeColor = '#000';
    }

    logView.circle.setAttribute('fill', fillColor);
    logView.circle.setAttribute('stroke-width', strokeWidth + '');
    logView.circle.setAttribute('stroke', strokeColor);
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
    const axis = this.viewSettings.getAxis();
    const { y } = this.viewPropertiesCache;
    const x = axis.input2output(this.span.startTime);
    this.viewPropertiesCache.x = x;
    this.container.setAttribute('transform', `translate(${x}, ${y})`);

    // Snap the label text to left of the screen
    if (x < 0) {
      this.labelText.setAttribute('x', (-x + this.viewSettings.spanLabelSnappedOffsetLeft) + '');
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
    const { spanBarMinWidth } = this.viewSettings;
    const axis = this.viewSettings.getAxis();
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

  updateColors() {
    this.viewPropertiesCache.barColor = this.viewSettings.spanColorFor(this.span);
    const { textColor, borderColor } = getSpanColors(this.viewPropertiesCache.barColor);
    this.viewPropertiesCache.labelColor = textColor;
    this.viewPropertiesCache.borderColor = borderColor;

    this.barRect.setAttribute('fill', this.viewPropertiesCache.barColor);
    // this.barRect.setAttribute('stroke', ??); // TODO: We don't know what the current style is
    this.labelText.setAttribute('fill', this.viewPropertiesCache.labelColor);
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

    this.logViews.forEach(l => this.container.removeChild(l.circle));

    this.logViews = this.span.logs.map((log) => {
      const id = shortid.generate();
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('r', spanLogCircleRadius + '');
      circle.setAttribute('cy', centerY + '');
      circle.setAttribute('fill', '#fff');
      circle.setAttribute('stroke', '#000');
      circle.setAttribute('stroke-width', '1');
      circle.setAttribute('clip-path', `url(#${this.clipPath.id})`);
      circle.setAttribute(TimelineInteractableElementAttribute, TimelineInteractableElementType.SPAN_VIEW_LOG_CIRCLE);
      circle.setAttribute('data-log-id', id);
      circle.setAttribute('data-span-id', this.span.id);
      this.container.appendChild(circle);
      return { id, log, circle };
    });
  }

  hideLogs() {
    this.logViews.forEach(l => this.container.removeChild(l.circle));
    this.logViews = [];
  }

  getLogViewById(logId: string) {
    return _.find(this.logViews, l => l.id === logId);
  }

  getLogViews() {
    return this.logViews;
  }

  getViewPropertiesCache() {
    return { ...this.viewPropertiesCache };
  }

  static getPropsFromContainer(el: Element) {
    return {
      id: el.getAttribute('data-span-id')
    };
  }

  static getPropsFromLogCircle(el: Element) {
    return {
      id: el.getAttribute('data-log-id'),
      spanId: el.getAttribute('data-span-id'),
    };
  }
}
