import find from 'lodash/find';
import { Span, SpanLog } from '../../model/interfaces';
import vc from './view-constants';
import * as shortid from 'shortid';
import { textColorFor } from '../ui/color-helper';
import {
  TimelineInteractableElementAttribute,
  TimelineInteractableElementType
} from './interaction';
import Axis from './axis';
import chroma from 'chroma-js';
import * as ErrorDetection from '../../model/error-detection';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SpanViewSharedOptions {
  axis: Axis;
  labelFor: (span: Span) => string;
  colorFor: (span: Span) => string;
}

export interface SpanLogViewObject {
  id: string;
  line: SVGLineElement;
  log: SpanLog;
}

export default class SpanView {
  span: Span;
  private sharedOptions: SpanViewSharedOptions;

  private container = document.createElementNS(SVG_NS, 'g');
  private barRect = document.createElementNS(SVG_NS, 'rect');
  private labelText = document.createElementNS(SVG_NS, 'text');
  private clipPath = document.createElementNS(SVG_NS, 'clipPath');
  private clipPathRect = document.createElementNS(SVG_NS, 'rect');
  private errorTriangle = document.createElementNS(SVG_NS, 'polygon');
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

    this.errorTriangle.setAttribute('fill', vc.spanErrorTriangleColor);

    this.labelText.setAttribute('x', vc.spanLabelOffsetLeft + '');
    this.labelText.setAttribute(
      'y',
      vc.spanBarHeight / 2 + vc.spanBarSpacing + vc.spanLabelOffsetTop + ''
    );
    this.labelText.setAttribute('font-size', vc.spanLabelFontSize + '');
    // this.labelText.setAttribute('font-weight', '600');

    this.clipPathRect.setAttribute('rx', vc.spanBarRadius + '');
    this.clipPathRect.setAttribute('ry', vc.spanBarRadius + '');
    this.clipPathRect.setAttribute('height', vc.spanBarHeight + '');
    this.clipPath.appendChild(this.clipPathRect);
  }

  mount(options: { groupContainer: SVGGElement; svgDefs: SVGDefsElement }) {
    options.groupContainer.appendChild(this.container);
    options.svgDefs.appendChild(this.clipPath);
  }

  unmount() {
    const parent1 = this.container.parentElement;
    parent1?.removeChild(this.container);

    const parent2 = this.clipPath.parentElement;
    parent2?.removeChild(this.clipPath);
  }

  // can throw
  // - this.sharedOptions.colorFor
  // - this.updateLabelText
  reuse(span: Span) {
    this.span = span;

    const baseColor = this.sharedOptions.colorFor(span);
    this.viewPropertiesCache.barColorDefault = chroma(baseColor)
      .alpha(0.75)
      .css();
    this.viewPropertiesCache.barColorHover = chroma(baseColor)
      .alpha(1.0)
      .css();
    const textColor = textColorFor(this.viewPropertiesCache.barColorDefault);
    this.viewPropertiesCache.labelColor = textColor;
    this.viewPropertiesCache.borderColor = chroma(baseColor)
      .darken(1)
      .alpha(1.0)
      .css();

    this.updateColorStyle('normal');
    this.updateLabelText();
    this.hideLabel();

    if (ErrorDetection.checkSpan(span)) {
      this.container.appendChild(this.errorTriangle);
    } else if (this.errorTriangle.parentElement) {
      this.errorTriangle.parentElement.removeChild(this.errorTriangle);
    }

    this.container.setAttribute(
      TimelineInteractableElementAttribute,
      TimelineInteractableElementType.SPAN_VIEW_CONTAINER
    );
    this.container.setAttribute('data-span-id', span.id);
    this.clipPath.id = `clip-path-span-${span.id}`;
    this.labelText.setAttribute('clip-path', `url(#${this.clipPath.id})`);

    const { spanBarHeight } = vc;
    const { x } = this.viewPropertiesCache;
    this.logViews.forEach(l => this.container.removeChild(l.line));

    this.logViews = this.span.logs.map(log => {
      const id = shortid.generate();
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('y1', '-3');
      line.setAttribute('y2', spanBarHeight + 3 + '');
      line.setAttribute('stroke-width', '1');
      // line.setAttribute('clip-path', `url(#${this.clipPath.id})`);

      if (ErrorDetection.checkLog(log)) {
        line.setAttribute('stroke', 'rgba(176, 8, 13, 0.9)');
      } else {
        line.setAttribute('stroke', 'rgba(0, 0, 0, 0.5)');
      }

      const logX = this.sharedOptions.axis.input2output(log.timestamp) - x;
      line.setAttribute('x1', logX + '');
      line.setAttribute('x2', logX + '');

      return { id, log, line };
    });
  }

  dispose() {
    this.unmount();
  }

  // Can throw
  // - this.sharedOptions.labelFor
  updateLabelText() {
    this.labelText.textContent = this.sharedOptions.labelFor(this.span);
  }

  updateColorStyle(style: 'normal' | 'hover' | 'selected') {
    let barColor = this.viewPropertiesCache.barColorDefault;
    let labelTextColor = this.viewPropertiesCache.labelColor;
    let strokeWidth = 0;
    let strokeColor = 'transparent';

    if (style === 'hover') {
      barColor = this.viewPropertiesCache.barColorHover;
      strokeWidth = 0;
      strokeColor = 'transparent';
    } else if (style === 'selected') {
      strokeWidth = 3;
      strokeColor = this.viewPropertiesCache.borderColor;
    }

    this.barRect.setAttribute('fill', barColor);
    this.barRect.setAttribute('stroke-width', strokeWidth + '');
    this.barRect.setAttribute('stroke', strokeColor);
    this.labelText.setAttribute('fill', labelTextColor);
  }

  updateVerticalPosition(rowIndex: number, dontApplyTransform = false) {
    const { spanBarSpacing, rowHeight, groupPaddingTop } = vc;
    const { x } = this.viewPropertiesCache;
    const y = groupPaddingTop + rowIndex * rowHeight + spanBarSpacing; // Relative y in pixels to group container
    this.viewPropertiesCache.y = y;
    !dontApplyTransform &&
      this.container.setAttribute('transform', `translate(${x}, ${y})`);
  }

  updateHorizontalPosition() {
    const axis = this.sharedOptions.axis;
    const { y } = this.viewPropertiesCache;
    const x = axis.input2output(this.span.startTime);
    this.viewPropertiesCache.x = x;
    this.container.setAttribute('transform', `translate(${x}, ${y})`);

    // Snap the label text to left of the screen
    if (x < 0) {
      this.labelText.setAttribute('x', -x + vc.spanLabelSnappedOffsetLeft + '');
    } else {
      this.labelText.setAttribute('x', vc.spanLabelOffsetLeft + '');
    }

    // Update logs
    this.logViews.forEach(logView => {
      const logX = axis.input2output(logView.log.timestamp) - x;
      logView.line.setAttribute('x1', logX + '');
      logView.line.setAttribute('x2', logX + '');
    });
  }

  updateWidth() {
    const { spanBarMinWidth } = vc;
    const axis = this.sharedOptions.axis;
    const startX = axis.input2output(this.span.startTime);
    const width = Math.max(
      axis.input2output(this.span.finishTime) - startX,
      spanBarMinWidth
    );
    this.viewPropertiesCache.width = width;
    this.barRect.setAttribute('width', width + '');
    this.clipPathRect.setAttribute('width', width + '');
    this.errorTriangle.setAttribute(
      'points',
      `${width - vc.spanErrorTriangleSize},0 ${width},0 ${width},${
        vc.spanErrorTriangleSize
      }`
    );

    this.labelText.setAttribute('display', width < 30 ? 'none' : '');
  }

  // can throw
  // - this.sharedOptions.colorFor
  updateColors() {
    const baseColor = this.sharedOptions.colorFor(this.span);
    this.viewPropertiesCache.barColorDefault = chroma(baseColor)
      .alpha(0.8)
      .css();
    this.viewPropertiesCache.barColorHover = chroma(baseColor)
      .alpha(1.0)
      .css();
    const textColor = textColorFor(this.viewPropertiesCache.barColorDefault);
    this.viewPropertiesCache.labelColor = textColor;
    this.viewPropertiesCache.borderColor = chroma(baseColor)
      .darken(1)
      .alpha(1.0)
      .css();

    this.barRect.setAttribute('fill', this.viewPropertiesCache.barColorDefault);
    // this.barRect.setAttribute('stroke', ??); // TODO: We don't know what the current style is
    this.labelText.setAttribute('fill', this.viewPropertiesCache.labelColor);
  }

  showLabel() {
    if (!this.labelText.parentElement)
      this.container.appendChild(this.labelText);
  }

  hideLabel() {
    if (this.labelText.parentElement)
      this.container.removeChild(this.labelText);
  }

  showLogs() {
    this.logViews.forEach(({ line }) => this.container.appendChild(line));
  }

  hideLogs() {
    this.logViews.forEach(l => l.line.parentElement?.removeChild(l.line));
  }

  getLogViewById(logId: string) {
    return find(this.logViews, l => l.id === logId);
  }

  getLogViews() {
    return this.logViews;
  }

  // Get
  getNearbyLogViews(absoluteX: number, threshold = 10) {
    const logViews: { logView: SpanLogViewObject; distance: number }[] = [];
    this.logViews.forEach(logView => {
      const logX = this.sharedOptions.axis.input2output(logView.log.timestamp);
      const distance = Math.abs(absoluteX - logX);
      if (distance > 10) return;
      logViews.push({ logView, distance });
    });
    return logViews;
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
      spanId: el.getAttribute('data-span-id')
    };
  }
}
