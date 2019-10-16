import TimelineView from '../view';
import TimelineViewSettings from '../view-settings';
import SpanView from '../span-view';
import GroupView from '../group-view';


export default class BaseAnnotation {
  protected underlayElements: SVGElement[] = [];
  protected overlayElements: SVGElement[] = [];

  constructor(protected deps: {
    timelineView: TimelineView,
    underlayPanel: SVGGElement,
    overlayPanel: SVGGElement,
    viewSettings: TimelineViewSettings,
    findSpanView : (spanId: string | ((spanView: SpanView) => boolean)) => [GroupView?, SpanView?],
    findSpanViews : (predicate: (spanView: SpanView) => boolean) => [GroupView, SpanView][]
  }) {
    // Noop
  }

  prepare(...args: any[]): void {
    // To be implemented
  }

  mount() {
    this.underlayElements.forEach(el => !el.parentElement && this.deps.underlayPanel.appendChild(el));
    this.overlayElements.forEach(el => !el.parentElement && this.deps.overlayPanel.appendChild(el));
  }

  unmount() {
    this.underlayElements.forEach(el => el.parentElement && el.parentElement.removeChild(el));
    this.overlayElements.forEach(el => el.parentElement && el.parentElement.removeChild(el));
  }

  update(): void {
    // To be implemented
  }
}
