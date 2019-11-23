import { Timeline } from '../timeline';


export default class BaseDecoration {
  protected underlayElements: SVGElement[] = [];
  protected overlayElements: SVGElement[] = [];

  constructor(protected timelineView: Timeline) {
    // Noop
  }

  prepare(...args: any[]): void {
    // To be implemented
  }

  mount() {
    this.underlayElements.forEach(el => !el.parentElement && this.timelineView.decorationUnderlayPanel.appendChild(el));
    this.overlayElements.forEach(el => !el.parentElement && this.timelineView.decorationOverlayPanel.appendChild(el));
  }

  unmount() {
    this.underlayElements.forEach(el => el.parentElement && el.parentElement.removeChild(el));
    this.overlayElements.forEach(el => el.parentElement && el.parentElement.removeChild(el));
  }

  update(): void {
    // To be implemented
  }
}
