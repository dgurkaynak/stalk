import find from 'lodash/find';
import defaults from 'lodash/defaults';
import { Span, SpanLog } from '../../model/interfaces';
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

export interface SpanViewStyle {
  barRadius: number;
  barHeight: number;
  barMinWidth: number;
  barMarginVertical: number;
  labelFontSize: number;
  labelOffsetLeft: number;
  labelSnappedOffsetLeft: number;
  labelOffsetTop: number;
  errorTriangleSize: number;
  errorTriangleColor: string;
}

export interface SpanViewComputedStyles extends SpanViewStyle {
  width: number;
  x: number;
  y: number;
  rowHeight: number; // barHeight + 2 * verticalMargin
  barColorDefault: string;
  barColorHover: string;
  labelColor: string;
  borderColor: string;
}

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

export class SpanView {
  span: Span;
  private sharedOptions: SpanViewSharedOptions;

  private container = document.createElementNS(SVG_NS, 'g');
  private barRect = document.createElementNS(SVG_NS, 'rect');
  private labelText = document.createElementNS(SVG_NS, 'text');
  private clipPath = document.createElementNS(SVG_NS, 'clipPath');
  private clipPathRect = document.createElementNS(SVG_NS, 'rect');
  private errorTriangle = document.createElementNS(SVG_NS, 'polygon');
  private logViews: SpanLogViewObject[] = [];

  private readonly computedStyles: SpanViewComputedStyles;

  constructor(options: {
    span: Span;
    sharedOptions: SpanViewSharedOptions;
    style?: Partial<SpanViewStyle>;
  }) {
    this.span = options.span;
    this.sharedOptions = options.sharedOptions;

    const style = defaults(options.style, {
      barRadius: 1,
      barHeight: 18,
      barMinWidth: 1,
      barMarginVertical: 3,
      labelFontSize: 10,
      labelOffsetLeft: 5,
      labelSnappedOffsetLeft: 5,
      labelOffsetTop: 1,
      errorTriangleColor: '#ff0000',
      errorTriangleSize: 10
    } as SpanViewStyle);
    this.computedStyles = {
      ...style,
      width: 0,
      x: 0,
      y: 0,
      rowHeight: 2 * style.barMarginVertical + style.barHeight,
      barColorDefault: '',
      barColorHover: '',
      labelColor: '',
      borderColor: ''
    };

    this.container.style.cursor = 'pointer';
    this.labelText.style.cursor = 'pointer';

    this.barRect.setAttribute('x', '0');
    this.barRect.setAttribute('y', '0');
    this.barRect.setAttribute('rx', style.barRadius + '');
    this.barRect.setAttribute('ry', style.barRadius + '');
    this.barRect.setAttribute('height', style.barHeight + '');
    this.container.appendChild(this.barRect);

    this.errorTriangle.setAttribute('fill', style.errorTriangleColor);

    this.labelText.setAttribute('x', style.labelOffsetLeft + '');
    this.labelText.setAttribute(
      'y',
      style.barHeight / 2 + style.barMarginVertical + style.labelOffsetTop + ''
    );
    this.labelText.setAttribute('font-size', style.labelFontSize + '');
    // this.labelText.setAttribute('font-weight', '600');

    this.clipPathRect.setAttribute('rx', style.barRadius + '');
    this.clipPathRect.setAttribute('ry', style.barRadius + '');
    this.clipPathRect.setAttribute('height', style.barHeight + '');
    this.clipPath.appendChild(this.clipPathRect);
  }

  mount(options: { parent: SVGGElement; svgDefs: SVGDefsElement }) {
    options.parent.appendChild(this.container);
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
    this.computedStyles.barColorDefault = chroma(baseColor)
      .alpha(0.75)
      .css();
    this.computedStyles.barColorHover = chroma(baseColor)
      .alpha(1.0)
      .css();
    const textColor = textColorFor(this.computedStyles.barColorDefault);
    this.computedStyles.labelColor = textColor;
    this.computedStyles.borderColor = chroma(baseColor)
      .darken(1)
      .alpha(1.0)
      .css();

    this.updateColorStyle('normal');
    this.updateLabelText();
    this.hideLabel();

    this.container.setAttribute(
      TimelineInteractableElementAttribute,
      TimelineInteractableElementType.SPAN_VIEW_CONTAINER
    );
    this.container.setAttribute('data-span-id', span.id);
    this.clipPath.id = `clip-path-span-${span.id}`;
    this.labelText.setAttribute('clip-path', `url(#${this.clipPath.id})`);

    if (ErrorDetection.checkSpan(span)) {
      this.errorTriangle.setAttribute('clip-path', `url(#${this.clipPath.id})`);
      this.container.appendChild(this.errorTriangle);
    } else if (this.errorTriangle.parentElement) {
      this.errorTriangle.removeAttribute('clip-path');
      this.errorTriangle.parentElement.removeChild(this.errorTriangle);
    }

    const { x, barHeight } = this.computedStyles;
    this.logViews.forEach(l => this.container.removeChild(l.line));

    this.logViews = this.span.logs.map(log => {
      const id = shortid.generate();
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('y1', '-4');
      line.setAttribute('y2', barHeight + 4 + '');
      line.setAttribute('stroke', 'rgba(0, 0, 0, 0.5)');
      line.setAttribute('stroke-width', '1');
      // line.setAttribute('clip-path', `url(#${this.clipPath.id})`);

      let logAdjustmentX = 0;
      if (ErrorDetection.checkLog(log)) {
        line.setAttribute('stroke', 'rgba(176, 8, 13, 0.9)');
        line.setAttribute('stroke-width', '2');
        logAdjustmentX = -1;
      }

      const logX =
        this.sharedOptions.axis.input2output(log.timestamp) -
        x +
        logAdjustmentX;
      line.setAttribute('x1', logX + '');
      line.setAttribute('x2', logX + '');

      return { id, log, line };
    });
  }

  dispose() {
    this.unmount();
  }

  /**
   * This method just updates options object, it does not
   * change any style/view of the span. You need to explicitly
   * call related `spanView.updateX()` method(s).
   */
  setSharedOptions(newSharedOptions: SpanViewSharedOptions) {
    this.sharedOptions = newSharedOptions;
  }

  // Can throw
  // - this.options.labelFor
  updateLabelText() {
    this.labelText.textContent = this.sharedOptions.labelFor(this.span);
  }

  updateColorStyle(style: 'normal' | 'hover' | 'selected') {
    let barColor = this.computedStyles.barColorDefault;
    let labelTextColor = this.computedStyles.labelColor;
    let strokeWidth = 0;
    let strokeColor = 'transparent';

    if (style === 'hover') {
      barColor = this.computedStyles.barColorHover;
      strokeWidth = 0;
      strokeColor = 'transparent';
    } else if (style === 'selected') {
      strokeWidth = 3;
      strokeColor = this.computedStyles.borderColor;
    }

    this.barRect.setAttribute('fill', barColor);
    this.barRect.setAttribute('stroke-width', strokeWidth + '');
    this.barRect.setAttribute('stroke', strokeColor);
    this.labelText.setAttribute('fill', labelTextColor);
  }

  updateVerticalPosition(rowIndex: number, dontApplyTransform = false) {
    const { x, rowHeight, barMarginVertical } = this.computedStyles;
    const y = rowIndex * rowHeight + barMarginVertical; // Relative y in pixels to group container
    this.computedStyles.y = y;
    !dontApplyTransform &&
      this.container.setAttribute('transform', `translate(${x}, ${y})`);
  }

  updateHorizontalPosition() {
    const { axis } = this.sharedOptions;
    const { y, labelSnappedOffsetLeft, labelOffsetLeft } = this.computedStyles;
    const x = axis.input2output(this.span.startTime);
    this.computedStyles.x = x;
    this.container.setAttribute('transform', `translate(${x}, ${y})`);

    // Snap the label text to left of the screen
    if (x < 0) {
      this.labelText.setAttribute('x', -x + labelSnappedOffsetLeft + '');
    } else {
      this.labelText.setAttribute('x', labelOffsetLeft + '');
    }

    // Update logs
    this.logViews.forEach(logView => {
      const logX = axis.input2output(logView.log.timestamp) - x;
      logView.line.setAttribute('x1', logX + '');
      logView.line.setAttribute('x2', logX + '');
    });
  }

  updateWidth() {
    const { axis } = this.sharedOptions;
    const { barMinWidth, errorTriangleSize } = this.computedStyles;
    const startX = axis.input2output(this.span.startTime);
    const width = Math.max(
      axis.input2output(this.span.finishTime) - startX,
      barMinWidth
    );
    this.computedStyles.width = width;
    this.barRect.setAttribute('width', width + '');
    this.clipPathRect.setAttribute('width', width + '');
    this.errorTriangle.setAttribute(
      'points',
      `${width - errorTriangleSize},0 ${width},0 ${width},${errorTriangleSize}`
    );

    this.labelText.setAttribute('display', width < 30 ? 'none' : '');
  }

  // can throw
  // - this.sharedOptions.colorFor
  updateColors() {
    const baseColor = this.sharedOptions.colorFor(this.span);
    this.computedStyles.barColorDefault = chroma(baseColor)
      .alpha(0.8)
      .css();
    this.computedStyles.barColorHover = chroma(baseColor)
      .alpha(1.0)
      .css();
    const textColor = textColorFor(this.computedStyles.barColorDefault);
    this.computedStyles.labelColor = textColor;
    this.computedStyles.borderColor = chroma(baseColor)
      .darken(1)
      .alpha(1.0)
      .css();

    this.barRect.setAttribute('fill', this.computedStyles.barColorDefault);
    // this.barRect.setAttribute('stroke', ??); // TODO: We don't know what the current style is
    this.labelText.setAttribute('fill', this.computedStyles.labelColor);
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

  getComputedStyles() {
    return this.computedStyles;
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
