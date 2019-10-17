import * as _ from 'lodash';
import BaseAnnotation from './base';
import SpanView from '../span-view';

const SVG_NS = 'http://www.w3.org/2000/svg';

enum ViewType {
  RECT = 'soa_circle'
}

interface SpanOverlayAnnotationSettings {
  spanView: SpanView,
  fill?: string,
  barRadius?: number,
  barHeight?: number,
}

export default class SpanOverlayAnnotation extends BaseAnnotation {
  static ViewType = ViewType;

  private settings?: SpanOverlayAnnotationSettings;
  private rect = document.createElementNS(SVG_NS, 'rect');

  prepare(settings: SpanOverlayAnnotationSettings) {
    this.settings = _.defaults(settings, {
      fill: 'rgba(255, 0, 0, 0.5)',
      barRadius: 5,
      barHeight: 20,
    });

    this.rect.setAttribute('x', '0');
    this.rect.setAttribute('y', '0');
    this.rect.setAttribute('rx', this.settings.barRadius + '');
    this.rect.setAttribute('ry', this.settings.barRadius + '');
    this.rect.setAttribute('height', this.settings.barHeight + '');
    this.rect.setAttribute('fill', this.settings.fill!);
    this.rect.setAttribute('data-view-type', ViewType.RECT);
    this.rect.setAttribute('data-span-id', this.settings.spanView.span.id);

    this.overlayElements = [this.rect];
  }

  update() {
    if (!this.settings) return;
    const span = this.settings.spanView.span;
    const [ groupView ] = this.deps.findSpanView(span.id);
    if (!groupView) return;
    const groupViewProps = groupView.getViewPropertiesCache();
    const spanViewProps = this.settings.spanView.getViewPropertiesCache();

    const y = groupViewProps.y + spanViewProps.y;
    this.rect.setAttribute('width', spanViewProps.width + '');
    this.rect.setAttribute('transform', `translate(${spanViewProps.x}, ${y})`);
  }
}
