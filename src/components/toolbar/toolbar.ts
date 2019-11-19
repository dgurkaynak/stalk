import tippy, { createSingleton, Instance as TippyInstance } from 'tippy.js';
import './toolbar.css';

export interface ToolbarOptions {
  element: HTMLDivElement;
}

export type ToolbarButtonType =
  | 'dataSources'
  | 'search'
  | 'traces'
  | 'groupLayoutMode'
  | 'groupingMode'
  | 'spanLabelling'
  | 'spanColoring'
  | 'leftPaneToggle'
  | 'bottomPaneToggle'
  | 'settings';

export type ToolbarButtonState = 'selected' | 'disabled';

export class Toolbar {
  private elements: {
    btn: {
      dataSources: HTMLDivElement;
      search: HTMLDivElement;
      traces: HTMLDivElement;
      groupLayoutMode: HTMLDivElement;
      groupingMode: HTMLDivElement;
      spanLabellingMode: HTMLDivElement;
      spanColoringMode: HTMLDivElement;
      leftPaneToggle: HTMLDivElement;
      bottomPaneToggle: HTMLDivElement;
      settings: HTMLDivElement;
    };
    tracesBadgeCount: HTMLDivElement;
  };
  private tooltips: {
    singleton: TippyInstance;
    dataSources: TippyInstance;
    search: TippyInstance;
    traces: TippyInstance;
    groupLayoutMode: TippyInstance;
    groupingMode: TippyInstance;
    spanLabellingMode: TippyInstance;
    spanColoringMode: TippyInstance;
    leftPaneToggle: TippyInstance;
    bottomPaneToggle: TippyInstance;
    settings: TippyInstance;
  };

  constructor(private options: ToolbarOptions) {
    const el = options.element;

    // Get dom references of required children components
    const dataSources = el.querySelector(
      '.toolbar-button.data-sources'
    ) as HTMLDivElement;
    const search = el.querySelector('.toolbar-button.search') as HTMLDivElement;
    const traces = el.querySelector('.toolbar-button.traces') as HTMLDivElement;
    const groupLayoutMode = el.querySelector(
      '.toolbar-button.group-layout-mode'
    ) as HTMLDivElement;
    const groupingMode = el.querySelector(
      '.toolbar-button.grouping-mode'
    ) as HTMLDivElement;
    const spanLabellingMode = el.querySelector(
      '.toolbar-button.span-labelling'
    ) as HTMLDivElement;
    const spanColoringMode = el.querySelector(
      '.toolbar-button.span-coloring'
    ) as HTMLDivElement;
    const leftPaneToggle = el.querySelector(
      '.toolbar-button.left-pane'
    ) as HTMLDivElement;
    const bottomPaneToggle = el.querySelector(
      '.toolbar-button.bottom-pane'
    ) as HTMLDivElement;
    const settings = el.querySelector(
      '.toolbar-button.settings'
    ) as HTMLDivElement;

    this.elements = {
      btn: {
        dataSources,
        search,
        traces,
        groupLayoutMode,
        groupingMode,
        spanLabellingMode,
        spanColoringMode,
        leftPaneToggle,
        bottomPaneToggle,
        settings
      },
      tracesBadgeCount: document.createElement('div')
    };

    for (let key in this.elements.btn) {
      const el = this.elements.btn[key];
      if (!el) throw new Error(`Expected button element: .${key}`);
    }
  }

  async init() {
    this.initTooltips();
    this.initTracesBadgeCount();
  }

  initTooltips() {
    const tooltips = {
      dataSources: tippy(this.elements.btn.dataSources, {
        content: 'Data Sources'
      }),
      search: tippy(this.elements.btn.search, { content: 'Search Traces' }),
      traces: tippy(this.elements.btn.traces, {
        content: 'Traces in the Stage'
      }),
      groupLayoutMode: tippy(this.elements.btn.groupLayoutMode, {
        content: 'Group Layout Mode'
      }),
      groupingMode: tippy(this.elements.btn.groupingMode, {
        content: 'Grouping Mode'
      }),
      spanLabellingMode: tippy(this.elements.btn.spanLabellingMode, {
        content: 'Span Labelling'
      }),
      spanColoringMode: tippy(this.elements.btn.spanColoringMode, {
        content: 'Span Coloring'
      }),
      leftPaneToggle: tippy(this.elements.btn.leftPaneToggle, {
        content: 'Toggle Left Pane'
      }),
      bottomPaneToggle: tippy(this.elements.btn.bottomPaneToggle, {
        content: 'Toggle Bottom Pane'
      }),
      settings: tippy(this.elements.btn.settings, { content: 'Settings' })
    };

    const singleton = createSingleton(Object.values(tooltips), {
      delay: 1000,
      updateDuration: 500,
      theme: 'toolbar-tooltip'
    });

    this.tooltips = { ...tooltips, singleton };
  }

  initTracesBadgeCount() {
    const el = this.elements.tracesBadgeCount;
    el.classList.add('toolbar-traces-badge-count');
  }

  updateTracesBadgeCount(count: number) {
    const el = this.elements.tracesBadgeCount;
    if (count > 0) {
      el.textContent = count + '';
      !el.parentElement && this.elements.btn.traces.appendChild(el);
    } else {
      el.parentElement && this.elements.btn.traces.removeChild(el);
    }
  }

  updateButtonSelection(
    type: ToolbarButtonType,
    isSelected: boolean,
    style: 'background-fill' | 'svg-fill'
  ) {
    const el = this.elements.btn[type];
    if (!el) return;
    const className = {
      'background-fill': 'selected',
      'svg-fill': 'selected-fill'
    }[style];
    isSelected ? el.classList.add(className) : el.classList.remove(className);
  }

  dispose() {
    for (let tippyIns of Object.values(this.tooltips)) {
      tippyIns.destroy();
    }
    this.tooltips = null;
    this.elements = null;
    this.options = null;
  }
}
