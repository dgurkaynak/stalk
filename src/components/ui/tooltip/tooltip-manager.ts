import tippy, {
  createSingleton,
  Instance as TippyInstance,
  Props as TippyProps
} from 'tippy.js';
import remove from 'lodash/remove';
import './tooltip.css';

let singletonIns: TooltipManager;

export class TooltipManager {
  private tippyOptions: [HTMLElement, Partial<TippyProps>][] = [];
  private tippyInstances: TippyInstance[] = [];
  private singletonTippyInstance: TippyInstance;

  static getSingleton() {
    if (!singletonIns) singletonIns = new TooltipManager();
    return singletonIns;
  }

  update() {
    this.disposeAllTooltips();
    this.tippyInstances = this.tippyOptions.map(([el, props]) =>
      tippy(el, props)
    );
    this.singletonTippyInstance = createSingleton(this.tippyInstances, {
      delay: 1000,
      duration: 0,
      updateDuration: 0,
      theme: 'tooltip',
      placement: 'top'
    });
  }

  addToSingleton(options: [HTMLElement, Partial<TippyProps>][]) {
    this.tippyOptions.push(...options);
    this.update();
  }

  removeFromSingleton(elements: HTMLElement[]) {
    remove(this.tippyOptions, ([el]) => elements.indexOf(el) > -1);
    this.update();
  }

  disposeAllTooltips() {
    this.tippyInstances.forEach(t => t.destroy());
    this.tippyInstances = [];

    if (this.singletonTippyInstance) {
      this.singletonTippyInstance.destroy();
      this.singletonTippyInstance = null;
    }
  }
}
