import Split from 'split.js';

export interface AppOptions {
  container: HTMLDivElement;
  toolbar: HTMLDivElement;
  mainSplitContainer: HTMLDivElement;
  bodySplitContainer: HTMLDivElement;
  bodyLeft: HTMLDivElement;
  bodyRight: HTMLDivElement;
  bottomSplitContainer: HTMLDivElement;
  bottomLeft: HTMLDivElement;
  bottomCenter: HTMLDivElement;
  bottomRight: HTMLDivElement;

  mainSplit: Split.Instance;
  bodySplit: Split.Instance;
  bottomSplit: Split.Instance;
}

export class App {
  constructor(private options: AppOptions) {
    // Noop
  }

  async init() {
    // Init flow
  }
}
