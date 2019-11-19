import Split from 'split.js';
import { Toolbar } from './components/toolbar/toolbar';
import 'tippy.js/dist/tippy.css';

export interface AppOptions {
  element: HTMLDivElement;
  mainSplit: Split.Instance;
  bodySplit: Split.Instance;
  bottomSplit: Split.Instance;
}

export class App {
  private elements: {
    toolbar: HTMLDivElement;
    bodyLeft: HTMLDivElement;
    bodyRight: HTMLDivElement;
    bottomLeft: HTMLDivElement;
    bottomCenter: HTMLDivElement;
    bottomRight: HTMLDivElement;
  };
  private toolbar: Toolbar;

  constructor(private options: AppOptions) {
    // Get dom references of required children components
    const toolbar = document.getElementById('toolbar') as HTMLDivElement;
    const bodyLeft = document.getElementById('body-left') as HTMLDivElement;
    const bodyRight = document.getElementById('body-right') as HTMLDivElement;
    const bottomLeft = document.getElementById('bottom-left') as HTMLDivElement;
    const bottomCenter = document.getElementById(
      'bottom-center'
    ) as HTMLDivElement;
    const bottomRight = document.getElementById(
      'bottom-right'
    ) as HTMLDivElement;

    this.elements = {
      toolbar,
      bodyLeft,
      bodyRight,
      bottomLeft,
      bottomCenter,
      bottomRight
    };

    for (let key in this.elements) {
      const el = this.elements[key];
      if (!el) throw new Error(`Expected child element: #${key}`);
    }

    // Create child components
    this.toolbar = new Toolbar({ element: toolbar });
  }

  async init() {
    await this.toolbar.init();
  }

  dispose() {
    this.toolbar.dispose();
    this.toolbar = null;
    this.elements = null;
    this.options = null;
  }
}
