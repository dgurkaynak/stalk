import Split from 'split.js';

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
      if (!el) throw new Error(`Expected child element with id #${key}`);
    }
  }

  async init() {
    // Init flow
  }
}
