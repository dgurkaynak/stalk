import * as _ from 'lodash';
import { Span, SpanLog } from '../../model/interfaces';
import vc from './view-constants';
import * as shortid from 'shortid';
import { getContrastColor } from '../ui/color-helper';
import { TimelineInteractableElementAttribute, TimelineInteractableElementType } from './interaction';
import Axis from './axis';
import chroma from 'chroma-js';



const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SpanViewSharedOptions {
  axis: Axis;
  labelFor: (span: Span) => string;
  colorFor: (span: Span) => string;
}

export interface SpanLogViewObject {
  id: string,
  circle: SVGCircleElement,
  log: SpanLog
}

export default class SpanView {
  span: Span;
  private sharedOptions: SpanViewSharedOptions;

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
    barColorDefault: '',
    barColorHover: '',
    labelColor: '',
    borderColor: ''
  };

  constructor(span: Span, sharedOptions: SpanViewSharedOptions) {
    this.span = span;
    this.sharedOptions = sharedOptions;

    this.container.style.cursor = 'pointer';
    this.labelText.style.cursor = 'pointer';

    this.barRect.setAttribute('x', '0');
    this.barRect.setAttribute('y', '0');
    this.barRect.setAttribute('rx', vc.spanBarRadius + '');
    this.barRect.setAttribute('ry', vc.spanBarRadius + '');
    this.barRect.setAttribute('height', vc.spanBarHeight + '');
    this.container.appendChild(this.barRect);

    this.labelText.setAttribute('x', vc.spanLabelOffsetLeft + '');
    this.labelText.setAttribute('y', (vc.spanBarHeight / 2 + vc.spanBarSpacing + vc.spanLabelOffsetTop) + '');
    this.labelText.setAttribute('font-size', vc.spanLabelFontSize + '');
    // this.labelText.setAttribute('font-weight', '600');

    this.clipPathRect.setAttribute('rx', vc.spanBarRadius + '');
    this.clipPathRect.setAttribute('ry', vc.spanBarRadius + '');
    this.clipPathRect.setAttribute('height', vc.spanBarHeight + '');
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

    const baseColor = this.sharedOptions.colorFor(span);
    this.viewPropertiesCache.barColorDefault = chroma(baseColor).alpha(0.8).css();
    this.viewPropertiesCache.barColorHover = chroma(baseColor).alpha(1.0).css();
    const textColor = getContrastColor(this.viewPropertiesCache.barColorDefault);
    this.viewPropertiesCache.labelColor = textColor;
    this.viewPropertiesCache.borderColor = chroma(baseColor).darken(1).alpha(1.0).css();

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
    this.labelText.textContent = this.sharedOptions.labelFor(this.span);
  }

  updateColorStyle(style: 'normal' | 'hover' | 'selected') {
    let barColor = this.viewPropertiesCache.barColorDefault;
    let labelTextColor = this.viewPropertiesCache.labelColor;
    let strokeWidth = 0;
    let strokeColor = 'transparent';
    let filter = '';

    if (style === 'hover') {
      barColor = this.viewPropertiesCache.barColorHover;
      strokeWidth = 0;
      strokeColor = 'transparent';
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

  updateVerticalPosition(rowIndex: number, dontApplyTransform = false) {
    const { spanBarSpacing, rowHeight, groupPaddingTop } = vc;
    const { x } = this.viewPropertiesCache;
    const y = groupPaddingTop + (rowIndex * rowHeight) + spanBarSpacing; // Relative y in pixels to group container
    this.viewPropertiesCache.y = y;
    !dontApplyTransform && this.container.setAttribute('transform', `translate(${x}, ${y})`);
  }

  updateHorizontalPosition() {
    const axis = this.sharedOptions.axis;
    const { y } = this.viewPropertiesCache;
    const x = axis.input2output(this.span.startTime);
    this.viewPropertiesCache.x = x;
    this.container.setAttribute('transform', `translate(${x}, ${y})`);

    // Snap the label text to left of the screen
    if (x < 0) {
      this.labelText.setAttribute('x', (-x + vc.spanLabelSnappedOffsetLeft) + '');
    } else {
      this.labelText.setAttribute('x', vc.spanLabelOffsetLeft + '');
    }

    // Update logs
    this.logViews.forEach((logView) => {
      const logX = axis.input2output(logView.log.timestamp) - x;
      logView.circle.setAttribute('cx', logX + '');
    });
  }

  updateWidth() {
    const { spanBarMinWidth } = vc;
    const axis = this.sharedOptions.axis;
    const startX = axis.input2output(this.span.startTime);
    const width = Math.max(axis.input2output(this.span.finishTime) - startX, spanBarMinWidth);
    this.viewPropertiesCache.width = width;
    this.barRect.setAttribute('width',  width + '');
    this.clipPathRect.setAttribute('width',  width + '');
  }

  updateColors() {
    const baseColor = this.sharedOptions.colorFor(this.span);
    this.viewPropertiesCache.barColorDefault = chroma(baseColor).alpha(0.8).css();
    this.viewPropertiesCache.barColorHover = chroma(baseColor).alpha(1.0).css();
    const textColor = getContrastColor(this.viewPropertiesCache.barColorDefault);
    this.viewPropertiesCache.labelColor = textColor;
    this.viewPropertiesCache.borderColor = chroma(baseColor).darken(1).alpha(1.0).css();

    this.barRect.setAttribute('fill', this.viewPropertiesCache.barColorDefault);
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
    const { spanBarHeight, spanLogCircleRadius } = vc;
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
