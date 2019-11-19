import Split from 'split.js';
import { Toolbar } from './components/toolbar/toolbar';
import throttle from 'lodash/throttle';
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
  private leftBodySplitSize: number;
  private bottomSplitSize: number;

  readonly throttled = {
    handleMainSplitDrag: throttle(this.handleMainSplitDrag.bind(this), 100),
    handleMainSplitDragEnd: this.handleMainSplitDragEnd.bind(this),
    handleBodySplitDrag: throttle(this.handleBodySplitDrag.bind(this), 100),
    handleBodySplitDragEnd: this.handleBodySplitDragEnd.bind(this),
    handleBottomSplitDrag: throttle(this.handleBottomSplitDrag.bind(this), 100),
    handleBottomSplitDragEnd: this.handleBottomSplitDragEnd.bind(this)
  } as const;

  private binded = {
    onLeftPaneButtonClick: this.onLeftPaneButtonClick.bind(this),
    onBottomPaneButtonClick: this.onBottomPaneButtonClick.bind(this)
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
      if (!el) throw new Error(`Expected child element: #${key}`);
    }

    // Get pane sizes
    this.leftBodySplitSize = this.options.bodySplit.getSizes()[0];
    if (this.leftBodySplitSize < 1) this.leftBodySplitSize = 50;
    this.bottomSplitSize = this.options.mainSplit.getSizes()[1];

    // Create child components
    this.toolbar = new Toolbar({
      element: toolbar,
      onLeftPaneButtonClick: this.binded.onLeftPaneButtonClick,
      onBottomPaneButtonClick: this.binded.onBottomPaneButtonClick
    });
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

  private onLeftPaneButtonClick(isExpanded: boolean) {
    if (isExpanded) {
      this.options.bodySplit.setSizes([
        this.leftBodySplitSize,
        100 - this.leftBodySplitSize
      ]);
    } else {
      this.options.bodySplit.collapse(0);
    }
  }

  private onBottomPaneButtonClick(isExpanded: boolean) {
    if (isExpanded) {
      this.options.mainSplit.setSizes([
        100 - this.bottomSplitSize,
        this.bottomSplitSize
      ]);
    } else {
      this.options.mainSplit.collapse(1);
    }
  }

  private handleMainSplitDrag(sizes: number[]) {
    this.bottomSplitSize = sizes[1];
  }

  private handleMainSplitDragEnd(sizes: number[]) {
    this.throttled.handleMainSplitDrag.cancel();
    this.bottomSplitSize = sizes[1];
    // If collapsed
    if (this.bottomSplitSize < 1) {
      this.bottomSplitSize = 25; // Reset the for when it's expanded on toolbar
      this.toolbar.updateBottomPaneExpansion(false);
    }
  }

  private handleBodySplitDrag(sizes: number[]) {
    this.leftBodySplitSize = sizes[0];
  }

  private handleBodySplitDragEnd(sizes: number[]) {
    this.throttled.handleBodySplitDrag.cancel();
    this.leftBodySplitSize = sizes[0];
    // If collapsed
    if (this.leftBodySplitSize < 1) {
      this.leftBodySplitSize = 50; // Reset the for when it's expanded on toolbar
      this.toolbar.updateLeftPaneExpansion(false);
    }
  }

  private handleBottomSplitDrag(sizes: number[]) {
    // TODO
  }

  private handleBottomSplitDragEnd(sizes: number[]) {
    this.throttled.handleBottomSplitDrag.cancel();
  }
}
