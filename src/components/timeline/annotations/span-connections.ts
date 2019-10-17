import * as _ from 'lodash';
import BaseAnnotation from './base';
import SpanView from '../span-view';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface SpanConnectionsAnnotationSettings {
  spanView: SpanView,
  strokeWidth?: number,
  strokeColor?: string,
  barHeight?: number,
}

export default class SpanConnectionsAnnotation extends BaseAnnotation {
  private settings?: SpanConnectionsAnnotationSettings;
  private lines: SVGLineElement[] = [];

  prepare(settings: SpanConnectionsAnnotationSettings) {
    this.settings = _.defaults(settings, {
      strokeWidth: 1,
      strokeColor: '#000',
      barHeight: 20
    });

    this.lines.forEach(l => l.parentElement && l.parentElement.removeChild(l));
    this.lines = [];

    const [groupView, spanView] = this.deps.findSpanView(this.settings.spanView.span.id);
    if (!groupView || !spanView) return;

    this.settings.spanView.span.references.forEach((ref) => {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('stroke-width', settings.strokeWidth + '');
      line.setAttribute('stroke', settings.strokeColor!);
      line.setAttribute('marker-end', `url(#arrow-head)`);
      this.lines.push(line);
    });

    this.overlayElements = this.lines;
  }

  update() {
    if (!this.settings) return;

    const [groupView, spanView] = this.deps.findSpanView(this.settings.spanView.span.id);
    if (!groupView || !spanView) return;
    const spanViewProps = spanView.getViewPropertiesCache();
    const groupViewProps = groupView.getViewPropertiesCache();

    this.settings.spanView.span.references.forEach((ref, i) => {
      const [referencedGroupView, referencedSpanView] = this.deps.findSpanView(ref.spanId);
      if (!referencedGroupView || !referencedSpanView) return;
      const refSpanViewProps = referencedSpanView.getViewPropertiesCache();
      const refGroupViewProps = referencedGroupView.getViewPropertiesCache();

      const line = this.lines[i];
      line.setAttribute('x1', (spanViewProps.x) + '');
      line.setAttribute('y1', (spanViewProps.y + groupViewProps.y + (this.settings!.barHeight! / 2)) + '');
      line.setAttribute('x2', (refSpanViewProps.x) + '');
      line.setAttribute('y2', (refSpanViewProps.y + refGroupViewProps.y + (this.settings!.barHeight! / 2)) + '');
    });
  }
}
