import defaults from 'lodash/defaults';
import BaseDecoration from './base';
import SpanView from '../span-view';
import GroupView from '../group-view';
import {
  TimelineInteractableElementAttribute,
  TimelineInteractableElementType
} from '../interaction';
import * as shortid from 'shortid';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SpanConnectionDecorationSettings {
  spanId1: string;
  spanId2: string;
  strokeWidth?: number;
  strokeColor?: string;
  strokeDasharray?: string;
  barHeight?: number;
  hoverStrokeWidth?: number;
  hoverStrokeColor?: string;
}

export class SpanConnectionDecoration extends BaseDecoration {
  readonly id = shortid.generate();
  private settings: SpanConnectionDecorationSettings = {
    spanId1: '',
    spanId2: '',
    strokeWidth: 1,
    strokeColor: 'rgba(0, 0, 0, 0.5)',
    strokeDasharray: '0',
    barHeight: 18,
    hoverStrokeWidth: 1,
    hoverStrokeColor: 'rgba(0, 0, 0, 1)'
  };
  private container = document.createElementNS(SVG_NS, 'g');
  private spanView1: SpanView;
  private groupView1: GroupView;
  private spanView2: SpanView;
  private groupView2: GroupView;
  private path = document.createElementNS(SVG_NS, 'path');

  prepare(settings: SpanConnectionDecorationSettings) {
    this.settings = defaults(settings, this.settings);

    this.path.parentElement?.removeChild(this.path);

    this.groupView1 = null;
    this.spanView1 = null;
    this.groupView2 = null;
    this.spanView2 = null;

    const [groupView1, spanView1] = this.timelineView.findSpanView(
      this.settings.spanId1
    );
    if (!groupView1 || !spanView1) return false; // this will force timelineview to unmount this decoration
    this.groupView1 = groupView1;
    this.spanView1 = spanView1;

    const [groupView2, spanView2] = this.timelineView.findSpanView(
      this.settings.spanId2
    );
    if (!groupView2 || !spanView2) return false; // this will force timelineview to unmount this decoration
    this.groupView2 = groupView2;
    this.spanView2 = spanView2;

    this.path.setAttribute('fill', 'transparent');
    this.path.setAttribute('stroke-width', settings.strokeWidth + '');
    this.path.setAttribute('stroke', settings.strokeColor);
    this.path.setAttribute('marker-end', `url(#arrow-head)`);
    this.path.setAttribute('stroke-dasharray', settings.strokeDasharray);
    this.path.setAttribute('cursor', `default`);

    this.path.setAttribute(
      TimelineInteractableElementAttribute,
      TimelineInteractableElementType.SPAN_CONNECTION
    );
    this.path.setAttribute('data-span-connection-id', this.id);
    this.path.setAttribute('data-from-span-id', spanView1.span.id);
    this.path.setAttribute('data-to-span-id', spanView2.span.id);

    this.container.appendChild(this.path);
    this.overlayElements = [this.container];
  }

  update() {
    if (!this.groupView1 || !this.spanView1) return;
    if (!this.groupView2 || !this.spanView2) return;

    const spanView1Props = this.spanView1.getViewPropertiesCache();
    const groupView1Props = this.groupView1.getViewPropertiesCache();
    const spanView2Props = this.spanView2.getViewPropertiesCache();
    const groupView2Props = this.groupView2.getViewPropertiesCache();
    const halfBarHeight = this.settings.barHeight / 2;
    const arrowHeadOffsetLeft = -3;
    const shouldHide =
      this.groupView1.options.isCollapsed &&
      this.groupView2.options.isCollapsed; // Do not show if both groups are collapsed

    let fromX = Math.min(
      spanView1Props.x + spanView1Props.width,
      spanView2Props.x
    );
    let fromY =
      groupView1Props.y +
      (this.groupView1.options.isCollapsed ? 0 : spanView1Props.y) +
      halfBarHeight;
    let fromSpanStartX = spanView1Props.x;
    let toX = spanView2Props.x + arrowHeadOffsetLeft;
    let toY =
      groupView2Props.y +
      (this.groupView2.options.isCollapsed ? 0 : spanView2Props.y) +
      halfBarHeight;

    const angle = (Math.atan2(toY - fromY, toX - fromX) / Math.PI) * 180;
    let isVertical = false;

    let fromControlX = 0;
    let fromControlY = 0;
    let toControlX = 0;
    let toControlY = 0;

    if (angle > 45 && angle < 135) {
      isVertical = true;
    } else if (angle < -45 && angle > -135) {
      isVertical = true;
    }

    // If it's vertical line, put an offset so that they dont collide with span bar rect
    if (isVertical) {
      if (fromY < toY) {
        fromY += halfBarHeight;
        fromControlY = fromY + 5;
      } else if (fromY > toY) {
        fromY -= halfBarHeight;
        fromControlY = fromY - 5;
      }

      let toControlXOffset = 20;
      toControlY = toY;

      // If y distance is higher than 1 row, increase the control point offset
      const verticalDistance = Math.abs(toControlY - fromControlY);
      if (verticalDistance > 100) {
        toControlXOffset = 50;
      } else if (verticalDistance > 30) {
        toControlXOffset = 25;
      }

      // fromX = Math.max(fromSpanStartX, fromX - toControlXOffset);
      fromControlX = fromX;
      toControlX = toX - toControlXOffset;
    } else {
      // Just draw horizontal linear-ish line
      fromControlX = fromX + 50;
      fromControlY = fromY;
      toControlX = toX - 50;
      toControlY = toY;

      // If there is two sequential bars on the same row
      // and they're like snapped to each other, handle it
      const distanceX = toX - fromX;
      if (fromY == toY && distanceX < 10) {
        fromX = Math.max(fromX - 15, spanView1Props.x);
        fromY -= halfBarHeight;
        toX = Math.min(toX + 15, spanView2Props.x + spanView2Props.width);
        toY -= halfBarHeight - arrowHeadOffsetLeft;

        fromControlX = fromX;
        fromControlY = fromY - 15;
        toControlX = toX;
        toControlY = toY - 15;
      }
    }

    this.path.setAttribute('opacity', shouldHide ? '0' : '1');
    this.path.setAttribute(
      'd',
      `M ${fromX} ${fromY} C ${fromControlX} ${fromControlY}, ${toControlX}  ${toControlY}, ${toX} ${toY}`
    );
  }

  updateStyle(style: 'normal' | 'hover') {
    if (style == 'normal') {
      this.path.setAttribute('stroke-width', this.settings.strokeWidth + '');
      this.path.setAttribute('stroke', this.settings.strokeColor);
      this.path.setAttribute('cursor', `default`);
      return;
    } else if (style == 'hover') {
      this.path.setAttribute(
        'stroke-width',
        this.settings.hoverStrokeWidth + ''
      );
      this.path.setAttribute('stroke', this.settings.hoverStrokeColor);
      this.path.setAttribute('cursor', `pointer`);
    }
  }

  static getPropsFromPathElement(el: Element) {
    return {
      id: el.getAttribute('data-span-connection-id'),
      fromSpanId: el.getAttribute('data-from-span-id'),
      toSpanId: el.getAttribute('data-to-span-id')
    };
  }
}
