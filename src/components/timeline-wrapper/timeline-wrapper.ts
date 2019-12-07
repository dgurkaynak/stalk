import { Timeline } from '../timeline/timeline';
import tippy, { createSingleton, Instance as TippyInstance } from 'tippy.js';
import {
  WidgetToolbarMenu,
  WidgetToolbarMenuItemOptions
} from '../ui/widget-toolbar/widget-toolbar-menu';
import processGroupingOptions from '../../model/span-grouping/process';
import serviceNameGroupingOptions from '../../model/span-grouping/service-name';
import traceGroupingOptions from '../../model/span-grouping/trace';
import {
  SpanColoringManager,
  SpanColoringRawOptions,
  SpanColoringOptions,
  operationColoringOptions,
  serviceColoringOptions
} from '../../model/span-coloring-manager';
import {
  SpanLabellingManager,
  SpanLabellingRawOptions,
  SpanLabellingOptions,
  operationLabellingOptions,
  serviceOperationLabellingOptions
} from '../../model/span-labelling-manager';
import { SpanGroupingManager } from '../../model/span-grouping/manager';
import { GroupLayoutType } from '../timeline/group-view';

import SvgTextbox from '!!raw-loader!@mdi/svg/svg/textbox.svg';
import SvgFormatColorFill from '!!raw-loader!@mdi/svg/svg/format-color-fill.svg';
import SvgSort from '!!raw-loader!@mdi/svg/svg/sort.svg';
import SvgCursorMove from '!!raw-loader!@mdi/svg/svg/cursor-move.svg';
import SvgSelection from '!!raw-loader!@mdi/svg/svg/selection.svg';
import SvgTooltipEdit from '!!raw-loader!@mdi/svg/svg/tooltip-edit.svg';
import '../ui/widget-toolbar/widget-toolbar.css';
import './timeline-wrapper.css';

const TOOLBAR_HEIGHT = 27; // TODO: Sorry :(

export class TimelineWrapper {
  readonly timeline = new Timeline();
  private elements = {
    container: document.createElement('div'),
    toolbar: document.createElement('div'),
    toolbarBtn: {
      moveTool: document.createElement('div'),
      selectionTool: document.createElement('div'),
      groupingMode: document.createElement('div'),
      spanLabellingMode: document.createElement('div'),
      spanColoringMode: document.createElement('div'),
      groupLayoutMode: document.createElement('div'),
      tooltipEditor: document.createElement('div')
    },
    timelineContainer: document.createElement('div')
  };
  private tooltips: {
    singleton: TippyInstance;
    groupingMode: TippyInstance;
    spanLabellingMode: TippyInstance;
    spanColoringMode: TippyInstance;
    groupLayoutMode: TippyInstance;
  };
  private dropdowns: {
    groupingMode: TippyInstance;
    spanLabellingMode: TippyInstance;
    spanColoringMode: TippyInstance;
    groupLayoutMode: TippyInstance;
  };

  private state = {
    groupingMode: processGroupingOptions.key, // Do not forget to change default value of TimelineView
    spanColoringMode: operationColoringOptions.key, // Do not forget to change default value of TimelineView
    spanLabellingMode: operationLabellingOptions.key, // Do not forget to change default value of TimelineView
    groupLayoutMode: GroupLayoutType.COMPACT // Do not forget to change default value of TimelineView
  };

  private binded = {
    onGroupingModeMenuItemClick: this.onGroupingModeMenuItemClick.bind(this),
    onSpanLabellingMenuItemClick: this.onSpanLabellingMenuItemClick.bind(this),
    onSpanColoringMenuItemClick: this.onSpanColoringMenuItemClick.bind(this),
    onGroupLayoutMenuItemClick: this.onGroupLayoutMenuItemClick.bind(this)
  };

  private groupingModeMenu = new WidgetToolbarMenu({
    // width: 150,
    items: [
      { type: 'item', text: 'Trace', id: traceGroupingOptions.key },
      { type: 'item', text: 'Process', id: processGroupingOptions.key },
      { type: 'item', text: 'Service', id: serviceNameGroupingOptions.key },
      { type: 'divider' },
      { type: 'item', text: 'Custom', icon: 'code-tags', id: 'custom' },
      {
        type: 'item',
        text: 'Manage All',
        icon: 'settings-outline',
        id: 'manage-all',
        disabled: true
      }
    ],
    onClick: this.binded.onGroupingModeMenuItemClick
  });
  private spanLabellingModeMenu = new WidgetToolbarMenu({
    // width: 150,
    items: [
      { type: 'item', text: 'Operation', id: operationLabellingOptions.key },
      {
        type: 'item',
        text: 'Service + Operation',
        id: serviceOperationLabellingOptions.key
      },
      { type: 'divider' },
      { type: 'item', text: 'Custom', icon: 'code-tags', id: 'custom' },
      {
        type: 'item',
        text: 'Manage All',
        icon: 'settings-outline',
        id: 'manage-all',
        disabled: true
      }
    ],
    onClick: this.binded.onSpanLabellingMenuItemClick
  });
  private spanColoringModeMenu = new WidgetToolbarMenu({
    // width: 150,
    items: [
      { type: 'item', text: 'Operation', id: operationColoringOptions.key },
      { type: 'item', text: 'Service', id: serviceColoringOptions.key },
      { type: 'divider' },
      { type: 'item', text: 'Custom', icon: 'code-tags', id: 'custom' },
      {
        type: 'item',
        text: 'Manage All',
        icon: 'settings-outline',
        id: 'manage-all',
        disabled: true
      }
    ],
    onClick: this.binded.onSpanColoringMenuItemClick
  });
  private groupLayoutModeMenu = new WidgetToolbarMenu({
    // width: 150,
    items: [
      { type: 'item', text: 'Fill', id: GroupLayoutType.FILL },
      { type: 'item', text: 'Compact', id: GroupLayoutType.COMPACT },
      { type: 'item', text: 'Waterfall', id: GroupLayoutType.WATERFALL }
    ],
    onClick: this.binded.onGroupLayoutMenuItemClick
  });

  constructor() {
    const { container, toolbar, timelineContainer } = this.elements;
    container.classList.add('timeline-wrapper');
    container.appendChild(toolbar);
    container.appendChild(timelineContainer);
    this.prepareToolbar();
    this.timeline.mount(timelineContainer);
  }

  private prepareToolbar() {
    const toolbarEl = this.elements.toolbar;
    const btn = this.elements.toolbarBtn;

    toolbarEl.classList.add('widget-toolbar', 'widget-toolbar');

    // Panes
    const leftPane = document.createElement('div');
    leftPane.classList.add('widget-toolbar-pane');
    toolbarEl.appendChild(leftPane);

    const middlePane = document.createElement('div');
    middlePane.classList.add('widget-toolbar-pane', 'middle');
    toolbarEl.appendChild(middlePane);

    const rightPane = document.createElement('div');
    rightPane.classList.add('widget-toolbar-pane', 'right');
    toolbarEl.appendChild(rightPane);

    // Buttons
    btn.moveTool.classList.add('widget-toolbar-button');
    btn.moveTool.innerHTML = SvgCursorMove;
    leftPane.appendChild(btn.moveTool);

    btn.selectionTool.classList.add('widget-toolbar-button');
    btn.selectionTool.innerHTML = SvgSelection;
    leftPane.appendChild(btn.selectionTool);

    btn.groupingMode.classList.add('widget-toolbar-button', 'fix-stroke');
    btn.groupingMode.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 24 24">
        <g>
          <rect height="6" width="18" y="4" x="2" fill="none" stroke-width="2"></rect>
          <line stroke-dasharray="2,2" y2="14" x2="24" y1="14" x1="0" fill="none" stroke-width="2"></line>
          <rect height="6" width="18" y="17" x="2" stroke="none"></rect>
        </g>
      </svg>`;
    middlePane.appendChild(btn.groupingMode);

    btn.spanLabellingMode.classList.add('widget-toolbar-button');
    btn.spanLabellingMode.innerHTML = SvgTextbox;
    middlePane.appendChild(btn.spanLabellingMode);

    btn.spanColoringMode.classList.add(
      'widget-toolbar-button',
      'span-coloring'
    );
    btn.spanColoringMode.innerHTML = SvgFormatColorFill;
    middlePane.appendChild(btn.spanColoringMode);

    btn.groupLayoutMode.classList.add('widget-toolbar-button', 'group-layout');
    btn.groupLayoutMode.innerHTML = SvgSort;
    middlePane.appendChild(btn.groupLayoutMode);

    btn.tooltipEditor.classList.add('widget-toolbar-button');
    btn.tooltipEditor.innerHTML = SvgTooltipEdit;
    rightPane.appendChild(btn.tooltipEditor);
  }

  init(options: { width: number; height: number }) {
    this.timeline.init({
      width: options.width,
      height: options.height - TOOLBAR_HEIGHT
    });
    this.initTooltips();
    this.initDropdowns();

    // Select default menus
    this.groupingModeMenu.selectAt(
      {
        [traceGroupingOptions.key]: 0,
        [processGroupingOptions.key]: 1,
        [serviceNameGroupingOptions.key]: 2,
        custom: 4
      }[this.state.groupingMode]
    );
    this.spanLabellingModeMenu.selectAt(
      {
        [operationLabellingOptions.key]: 0,
        [serviceOperationLabellingOptions.key]: 1,
        custom: 3
      }[this.state.spanLabellingMode]
    );
    this.spanColoringModeMenu.selectAt(
      {
        [operationColoringOptions.key]: 0,
        [serviceColoringOptions.key]: 1,
        custom: 3
      }[this.state.spanColoringMode]
    );
    this.groupLayoutModeMenu.selectAt(
      {
        [GroupLayoutType.FILL]: 0,
        [GroupLayoutType.COMPACT]: 1,
        [GroupLayoutType.WATERFALL]: 2
      }[this.state.groupLayoutMode]
    );
  }

  private initTooltips() {
    const btn = this.elements.toolbarBtn;
    const tooltips = {
      groupingMode: tippy(btn.groupingMode, {
        content: 'Span Grouping',
        multiple: true
      }),
      spanLabellingMode: tippy(btn.spanLabellingMode, {
        content: 'Span Labelling',
        multiple: true
      }),
      spanColoringMode: tippy(btn.spanColoringMode, {
        content: 'Span Coloring',
        multiple: true
      }),
      groupLayoutMode: tippy(btn.groupLayoutMode, {
        content: 'Draw Layout',
        multiple: true
      })
    };

    const singleton = createSingleton(Object.values(tooltips), {
      delay: 1000,
      duration: 0,
      updateDuration: 0,
      theme: 'widget-toolbar-tooltip'
    });

    this.tooltips = { ...tooltips, singleton };
  }

  private initDropdowns() {
    const btn = this.elements.toolbarBtn;
    this.dropdowns = {
      groupingMode: tippy(btn.groupingMode, {
        content: this.groupingModeMenu.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        duration: 0,
        updateDuration: 0,
        theme: 'widget-toolbar-menu',
        trigger: 'click',
        interactive: true
      }),
      spanLabellingMode: tippy(btn.spanLabellingMode, {
        content: this.spanLabellingModeMenu.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        duration: 0,
        updateDuration: 0,
        theme: 'widget-toolbar-menu',
        trigger: 'click',
        interactive: true
      }),
      spanColoringMode: tippy(btn.spanColoringMode, {
        content: this.spanColoringModeMenu.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        duration: 0,
        updateDuration: 0,
        theme: 'widget-toolbar-menu',
        trigger: 'click',
        interactive: true
      }),
      groupLayoutMode: tippy(btn.groupLayoutMode, {
        content: this.groupLayoutModeMenu.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        duration: 0,
        updateDuration: 0,
        theme: 'widget-toolbar-menu',
        trigger: 'click',
        interactive: true
      })
    };
  }

  private onGroupingModeMenuItemClick(
    item: WidgetToolbarMenuItemOptions,
    index: number
  ) {
    this.dropdowns.groupingMode.hide();

    if (item.id === 'manage-all') {
      // TODO
      return;
    }

    if (item.id === 'custom') {
      // TODO
      return;
    }

    const spanGroupingOptions = SpanGroupingManager.getSingleton().getOptions(
      item.id
    );
    if (!spanGroupingOptions) {
      // message.error(`Unknown span grouping: "${item.id}"`);
      return;
    }

    this.timeline.updateSpanGrouping(spanGroupingOptions);
    this.state.groupingMode = item.id;
    this.groupingModeMenu.selectAt(index);
  }

  private onSpanLabellingMenuItemClick(
    item: WidgetToolbarMenuItemOptions,
    index: number
  ) {
    this.dropdowns.spanLabellingMode.hide();

    if (item.id === 'manage-all') {
      // TODO
      return;
    }

    if (item.id === 'custom') {
      // TODO
      return;
    }

    const spanLabellingOptions = SpanLabellingManager.getSingleton().getOptions(
      item.id
    );
    if (!spanLabellingOptions) {
      // message.error(`Unknown span labelling: "${item.id}"`);
      return;
    }

    this.timeline.updateSpanLabelling(spanLabellingOptions);
    this.state.spanLabellingMode = item.id;
    this.spanLabellingModeMenu.selectAt(index);
  }

  private onSpanColoringMenuItemClick(
    item: WidgetToolbarMenuItemOptions,
    index: number
  ) {
    this.dropdowns.spanColoringMode.hide();

    if (item.id === 'manage-all') {
      // TODO
      return;
    }

    if (item.id === 'custom') {
      // TODO
      return;
    }

    const spanColoringOptions = SpanColoringManager.getSingleton().getOptions(
      item.id
    );
    if (!spanColoringOptions) {
      // message.error(`Unknown span coloring: "${item.id}"`);
      return;
    }

    this.timeline.updateSpanColoring(spanColoringOptions);
    this.state.spanColoringMode = item.id;
    this.spanColoringModeMenu.selectAt(index);
  }

  private onGroupLayoutMenuItemClick(
    item: WidgetToolbarMenuItemOptions,
    index: number
  ) {
    this.timeline.updateGroupLayoutMode(item.id as GroupLayoutType);
    this.groupLayoutModeMenu.selectAt(index);
    this.dropdowns.groupLayoutMode.hide();
  }

  mount(parentEl: HTMLElement) {
    parentEl.appendChild(this.elements.container);
  }

  unmount() {
    const parent = this.elements.container.parentElement;
    parent && parent.removeChild(this.elements.container);
  }

  resize(width: number, height: number) {
    this.timeline.resize(width, height - TOOLBAR_HEIGHT);
  }

  dispose() {
    // TODO:
  }
}
