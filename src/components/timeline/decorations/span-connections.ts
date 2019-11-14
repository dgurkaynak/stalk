import * as _ from 'lodash';
import BaseDecoration from './base';
import SpanView from '../span-view';
import GroupView from '../group-view';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface SpanConnectionsDecorationSettings {
  spanId: string,
  strokeWidth?: number,
  strokeColor?: string,
  barHeight?: number,
}

interface SpanConnection {
  spanView: SpanView,
  groupView: GroupView,
  refType: 'childOf' | 'followsFrom',
  type: 'parent' | 'child',
  path: SVGPathElement
}

export default class SpanConnectionsDecoration extends BaseDecoration {
  private settings: SpanConnectionsDecorationSettings = {
    spanId: '',
    strokeWidth: 1,
    strokeColor: '#000',
    barHeight: 18
  };
  private container = document.createElementNS(SVG_NS, 'g');
  private parents: SpanConnection[] = [];
  private children: SpanConnection[] = [];
  private groupView: GroupView;
  private spanView: SpanView;

  prepare(settings: SpanConnectionsDecorationSettings) {
    this.settings = _.defaults(settings, this.settings);

    this.parents.forEach(({ path }) => path.parentElement && path.parentElement.removeChild(path));
    this.parents = [];
    this.children.forEach(({ path }) => path.parentElement && path.parentElement.removeChild(path));
    this.children = [];

    this.groupView = null;
    this.spanView = null;

    const [groupView, spanView] = this.timelineView.findSpanView(this.settings.spanId);
    if (!groupView || !spanView) return false; // this will force timelineview to unmount this decoration
    this.groupView = groupView;
    this.spanView = spanView;

    spanView.span.references.forEach((ref) => {
      const [refGroupView, refSpanView] = this.timelineView.findSpanView(ref.spanId);
      if (!refGroupView || !refSpanView) return;
      // TODO: Indicate when span could not found
      // TODO: Handle if groupView is collapsed

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('fill', 'transparent');
      path.setAttribute('stroke-width', settings.strokeWidth + '');
      path.setAttribute('stroke', settings.strokeColor);
      path.setAttribute('marker-end', `url(#arrow-head)`);
      path.setAttribute('stroke-dasharray', ref.type === 'followsFrom' ? '2' : '0');
      this.container.appendChild(path);

      this.parents.push({
        spanView: refSpanView,
        groupView: refGroupView,
        refType: ref.type,
        type: 'parent',
        path
      });
    });

    const childrenMatches = this.timelineView.findSpanViews((v) => {
      const selfReferences = _.find(v.span.references, r => r.spanId === this.settings.spanId);
      return !!selfReferences;
    });

    childrenMatches.forEach(([ refGroupView, refSpanView ]) => {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('fill', 'transparent');
      path.setAttribute('stroke-width', settings.strokeWidth + '');
      path.setAttribute('stroke', settings.strokeColor);
      path.setAttribute('marker-end', `url(#arrow-head)`);
      const ref = _.find(refSpanView.span.references, r => r.spanId === this.settings.spanId);
      path.setAttribute('stroke-dasharray', ref!.type === 'followsFrom' ? '2' : '0');
      this.container.appendChild(path);

      this.children.push({
        spanView: refSpanView,
        groupView: refGroupView,
        refType: ref!.type,
        type: 'child',
        path
      });
    });

    this.overlayElements = [ this.container ];
  }

  update() {
    if (!this.groupView || !this.spanView) return;

    const spanViewProps = this.spanView.getViewPropertiesCache();
    const groupViewProps = this.groupView.getViewPropertiesCache();
    const halfBarHeight = this.settings.barHeight / 2;

    [ ...this.parents, ...this.children ].forEach((ref) => {
      const refSpanViewProps = ref.spanView.getViewPropertiesCache();
      const refGroupViewProps = ref.groupView.getViewPropertiesCache();
      const path = ref.path;
      const arrowHeadOffsetLeft = -3;

      let fromX = 0;
      let fromY = 0;
      let fromSpanStartX = 0;
      let toX = 0;
      let toY = 0;

      switch(ref.type) {
        case 'parent': {
            fromX = Math.min(refSpanViewProps.x + refSpanViewProps.width, spanViewProps.x);
            fromY = refGroupViewProps.y + refSpanViewProps.y + halfBarHeight;
            fromSpanStartX = refSpanViewProps.x;
            toX = spanViewProps.x + arrowHeadOffsetLeft;
            toY = groupViewProps.y + spanViewProps.y + halfBarHeight;
          break;
        }

        case 'child': {
          fromX = Math.min(spanViewProps.x + spanViewProps.width, refSpanViewProps.x);
          fromY = groupViewProps.y + spanViewProps.y + halfBarHeight;
          fromSpanStartX = spanViewProps.x;
          toX = refSpanViewProps.x + arrowHeadOffsetLeft;
          toY = refGroupViewProps.y + refSpanViewProps.y + halfBarHeight;
          break;
        }

        default: throw new Error(`Could not draw connection, reference type "${ref.type} not supported"`);
      }

      const angle = Math.atan2(toY - fromY, toX - fromX) / Math.PI * 180;
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
      }

      path.setAttribute('d', `M ${fromX} ${fromY} C ${fromControlX} ${fromControlY}, ${toControlX}  ${toControlY}, ${toX} ${toY}`);

    }); // forEach end

  }
}
