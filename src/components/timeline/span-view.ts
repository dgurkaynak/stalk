import { Span } from '../../model/span';
import ViewSettings from './view-settings';
import ColorManagers from '../color/managers';
import invert from 'invert-color';


const SVG_NS = 'http://www.w3.org/2000/svg';


export default class SpanView {
  span: Span;
  viewSettings: ViewSettings;
  options = {
    isCollapsed: false
  };

  private containaer = document.createElementNS(SVG_NS, 'g');
  private barRect = document.createElementNS(SVG_NS, 'rect');
  private labelText = document.createElementNS(SVG_NS, 'text');

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

    this.barRect.setAttribute('x', '0');
    this.barRect.setAttribute('y', '0');
    this.barRect.setAttribute('rx', this.viewSettings.spanBarRadius + '');
    this.barRect.setAttribute('ry', this.viewSettings.spanBarRadius + '');
    this.containaer.appendChild(this.barRect);

    this.labelText.setAttribute('x', '0');
    this.labelText.setAttribute('y', '0');
    this.labelText.setAttribute('font-size', this.viewSettings.spanLabelFontSize + '');
  }

  mount(parentElement: SVGGElement) {
    parentElement.appendChild(this.containaer);
  }

  unmount() {
    const parentElement = this.containaer.parentElement;
    parentElement && parentElement.removeChild(this.containaer);
  }

  reuse(span: Span) {
    this.span = span;
    this.updateColoring();
    this.updateLabelText();
    this.hideLabel();
  }

  updateLabelText() {
    this.labelText.textContent = this.span.operationName;
  }

  updateColoring() {
    const barColor = ColorManagers.operationName.colorFor(this.span.operationName) as string;
    this.barRect.setAttribute('fill', barColor);
    this.labelText.setAttribute('fill', invert(barColor, true));
  }

  updateVerticalPosition(rowIndex: number, dontApplyTransform = false) {
    const { spanBarSpacing, rowHeight } = this.viewSettings;
    const { x } = this.viewPropertiesCache;
    const y = (rowIndex * rowHeight) + spanBarSpacing;
    this.viewPropertiesCache.y = y;
    !dontApplyTransform && this.containaer.setAttribute('transform', `translate(${x}, ${y})`);
  }

  updateHorizontalPosition() {
    const { axis } = this.viewSettings;
    const { y } = this.viewPropertiesCache;
    const x = axis.input2output(this.span.startTime);
    this.viewPropertiesCache.x = x;
    this.containaer.setAttribute('transform', `translate(${x}, ${y})`);
  }

  updateWidth() {
    const { axis, spanBarMinWidth } = this.viewSettings;
    const startX = axis.input2output(this.span.startTime);
    const width = Math.max(axis.input2output(this.span.finishTime) - startX, spanBarMinWidth);
    this.viewPropertiesCache.width = width;
    this.barRect.setAttribute('width',  width + '');
  }

  updateHeight() {
    const { spanBarHeight, spanBarSpacing, spanLabelOffsetLeft, spanLabelOffsetTop } = this.viewSettings;

    // Update bar height
    this.barRect.setAttribute('height', spanBarHeight + '');

    // Update label text positioning
    this.labelText.setAttribute('x', spanLabelOffsetLeft + '');
    this.labelText.setAttribute('y', (spanBarHeight / 2 + spanBarSpacing + spanLabelOffsetTop) + '');
  }

  showLabel() {
    if (!this.labelText.parentElement) this.containaer.appendChild(this.labelText);
  }

  hideLabel() {
    if (this.labelText.parentElement) this.containaer.removeChild(this.labelText);
  }
}
