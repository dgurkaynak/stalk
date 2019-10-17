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
    line: SVGLineElement
  }[] = [];
  private children: {
    spanView: SpanView,
    groupView: GroupView,
    refType: 'childOf' | 'followsFrom',
    type: 'parent' | 'child',
    line: SVGLineElement
  }[] = [];
  private groupView?: GroupView;

  prepare(settings: SpanConnectionsAnnotationSettings) {
    this.settings = _.defaults(settings, {
      strokeWidth: 1,
      strokeColor: '#000',
      barHeight: 20
    });

    this.parents.forEach(({ line }) => line.parentElement && line.parentElement.removeChild(line));
    this.parents = [];
    this.children.forEach(({ line }) => line.parentElement && line.parentElement.removeChild(line));
    this.children = [];

    const [groupView, spanView] = this.deps.findSpanView(this.settings.spanView.span.id);
    if (!groupView || !spanView) return;
    this.groupView = groupView;

    this.settings.spanView.span.references.forEach((ref) => {
      const [refGroupView, refSpanView] = this.deps.findSpanView(ref.spanId);
      if (!refGroupView || !refSpanView) return;

      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('stroke-width', settings.strokeWidth + '');
      line.setAttribute('stroke', settings.strokeColor!);
      line.setAttribute('marker-end', `url(#arrow-head)`);

      this.parents.push({
        spanView: refSpanView,
        groupView: refGroupView,
        refType: ref.type,
        type: 'parent',
        line
      });
    });

    const childrenMatches = this.deps.findSpanViews((v) => {
      const selfReferences = _.find(v.span.references, r => r.spanId === spanView.span.id);
      return !!selfReferences;
    });

    childrenMatches.forEach(([ refGroupView, refSpanView ]) => {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('stroke-width', settings.strokeWidth + '');
      line.setAttribute('stroke', settings.strokeColor!);
      line.setAttribute('marker-end', `url(#arrow-head)`);
      const ref = _.find(refSpanView.span.references, r => r.spanId === spanView.span.id);

      this.children.push({
        spanView: refSpanView,
        groupView: refGroupView,
        refType: ref!.type,
        type: 'child',
        line
      });
    });

    const parentLines = this.parents.map(p => p.line);
    const childrenLines = this.children.map(p => p.line);
    this.overlayElements = [ ...parentLines, ...childrenLines ];
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
      const line = ref.line;

      let fromX = 0;
      let fromY = 0;
      let toX = 0;
      let toY = 0;

      switch(ref.type) {
        case 'parent': {
            fromX = Math.min(refSpanViewProps.x + refSpanViewProps.width, spanViewProps.x);
            fromY = refGroupViewProps.y + refSpanViewProps.y + halfBarHeight;
            toX = spanViewProps.x;
            toY = groupViewProps.y + spanViewProps.y + halfBarHeight;
          break;
        }

        case 'child': {
          fromX = Math.min(spanViewProps.x + spanViewProps.width, refSpanViewProps.x);
          fromY = groupViewProps.y + spanViewProps.y + halfBarHeight;
          toX = refSpanViewProps.x;
          toY = refGroupViewProps.y + refSpanViewProps.y + halfBarHeight;
          break;
        }

        default: throw new Error(`Could not draw connection, reference type "${ref.type} not supported"`);
      }

      const angle = Math.atan2(toY - fromY, toX - fromX) / Math.PI * 180;
      let isVertical = false;

      if (angle > 45 && angle < 135) {
        isVertical = true;
      } else if (angle < -45 && angle > -135) {
        isVertical = true;
      }

      // If it's vertical line, put an offset so that they dont collide with span bar rect
      if (isVertical) {
        if (fromY < toY) {
          fromY += halfBarHeight;
          toY -= halfBarHeight;
        } else if (fromY > toY) {
          fromY -= halfBarHeight;
          toY += halfBarHeight;
        }
      }

      line.setAttribute('x1', fromX + '');
      line.setAttribute('y1', fromY + '');
      line.setAttribute('x2', toX + '');
      line.setAttribute('y2', toY + '');

    }); // forEach end

  }
}
