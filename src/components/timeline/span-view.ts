import * as _ from 'lodash';
import { Span, SpanLog } from '../../model/span';
import ViewSettings from './view-settings';
import * as shortid from 'shortid';
// import { RandomColorAssigner } from '../color/assigners/randomcolor';
import { MPN65ColorAssigner } from '../color/assigners/mpn65';
import { getSpanColors } from '../color/helper';

// const randomColorAssigner = new RandomColorAssigner();
const randomColorAssigner = new MPN65ColorAssigner();


const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SpanLogViewObject {
  id: string,
  circle: SVGCircleElement,
  log: SpanLog
}

enum ViewType {
  CONTAINER = 's_container',
  LOG_CIRCLE = 's_log_circle'
}

export default class SpanView {
  static ViewType = ViewType;

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

    this.viewPropertiesCache.barColor = randomColorAssigner.colorFor(span.operationName) as string;
    const { textColor, darkColor } = getSpanColors(this.viewPropertiesCache.barColor);
    this.viewPropertiesCache.labelColor = textColor;
    this.viewPropertiesCache.borderColor = darkColor;

    this.updateColorStyle('normal');
    this.updateLabelText();
    this.hideLabel();

    this.container.setAttribute('data-view-type', ViewType.CONTAINER);
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
      circle.setAttribute('data-view-type', ViewType.LOG_CIRCLE);
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
}
