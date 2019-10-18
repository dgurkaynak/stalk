import * as _ from 'lodash';
import BaseAnnotation from './base';
import SpanView from '../span-view';
import GroupView from '../group-view';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface SpanConnectionsAnnotationSettings {
  spanView: SpanView,
  strokeWidth?: number,
  strokeColor?: string,
  barHeight?: number,
}

export default class SpanConnectionsAnnotation extends BaseAnnotation {
  private settings?: SpanConnectionsAnnotationSettings;
  private parents: {
    spanView: SpanView,
    groupView: GroupView,
    refType: 'childOf' | 'followsFrom',
    type: 'parent' | 'child',
    path: SVGPathElement
  }[] = [];
  private children: {
    spanView: SpanView,
    groupView: GroupView,
    refType: 'childOf' | 'followsFrom',
    type: 'parent' | 'child',
    path: SVGPathElement
  }[] = [];
  private groupView?: GroupView;

  prepare(settings: SpanConnectionsAnnotationSettings) {
    this.settings = _.defaults(settings, {
      strokeWidth: 1,
      strokeColor: '#000',
      barHeight: 20
    });

    this.parents.forEach(({ path }) => path.parentElement && path.parentElement.removeChild(path));
    this.parents = [];
    this.children.forEach(({ path }) => path.parentElement && path.parentElement.removeChild(path));
    this.children = [];

    const [groupView, spanView] = this.deps.findSpanView(this.settings.spanView.span.id);
    if (!groupView || !spanView) return;
    this.groupView = groupView;

    this.settings.spanView.span.references.forEach((ref) => {
      const [refGroupView, refSpanView] = this.deps.findSpanView(ref.spanId);
      if (!refGroupView || !refSpanView) return;

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('fill', 'transparent');
      path.setAttribute('stroke-width', settings.strokeWidth + '');
      path.setAttribute('stroke', settings.strokeColor!);
      path.setAttribute('marker-end', `url(#arrow-head)`);
      path.setAttribute('stroke-dasharray', ref.type === 'followsFrom' ? '2' : '0');

      this.parents.push({
        spanView: refSpanView,
        groupView: refGroupView,
        refType: ref.type,
        type: 'parent',
        path
      });
    });

    const childrenMatches = this.deps.findSpanViews((v) => {
      const selfReferences = _.find(v.span.references, r => r.spanId === spanView.span.id);
      return !!selfReferences;
    });

    childrenMatches.forEach(([ refGroupView, refSpanView ]) => {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('fill', 'transparent');
      path.setAttribute('stroke-width', settings.strokeWidth + '');
      path.setAttribute('stroke', settings.strokeColor!);
      path.setAttribute('marker-end', `url(#arrow-head)`);
      const ref = _.find(refSpanView.span.references, r => r.spanId === spanView.span.id);
      path.setAttribute('stroke-dasharray', ref!.type === 'followsFrom' ? '2' : '0');

      this.children.push({
        spanView: refSpanView,
        groupView: refGroupView,
        refType: ref!.type,
        type: 'child',
        path
      });
    });

    const parentPaths = this.parents.map(p => p.path);
    const childrenPaths = this.children.map(p => p.path);
    this.overlayElements = [ ...parentPaths, ...childrenPaths ];
  }

  update() {
    if (!this.settings) return;
    if (!this.groupView) return;

    const spanViewProps = this.settings.spanView.getViewPropertiesCache();
    const groupViewProps = this.groupView.getViewPropertiesCache();
    const halfBarHeight = this.settings!.barHeight! / 2;

    [ ...this.parents, ...this.children ].forEach((ref) => {
      const refSpanView = ref.spanView;
      const refSpanViewProps = ref.spanView.getViewPropertiesCache();
      const refGroupView = ref.groupView;
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

        fromX = Math.max(fromSpanStartX, fromX - toControlXOffset);
        fromControlX = fromX;
        toControlX = toX - toControlXOffset;

      } else {
        // Just draw linear-ish line
        fromControlX = fromX + 50;
        fromControlY = fromY;
        toControlX = toX - 50;
        toControlY = toY;
      }

      path.setAttribute('d', `M ${fromX} ${fromY} C ${fromControlX} ${fromControlY}, ${toControlX}  ${toControlY}, ${toX} ${toY}`);

    }); // forEach end

  }
}
