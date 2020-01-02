import { Timeline, TimelineTool } from '../timeline/timeline';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import {
  WidgetToolbarSelect,
  WidgetToolbarSelectItem
} from '../ui/widget-toolbar/widget-toolbar-select';
import {
  WidgetToolbarMultiSelect,
  WidgetToolbarMultiSelectItem
} from '../ui/widget-toolbar/widget-toolbar-multi-select';
import processGroupingOptions from '../../model/span-grouping/process';
import serviceNameGroupingOptions from '../../model/span-grouping/service-name';
import traceGroupingOptions from '../../model/span-grouping/trace';
import {
  SpanColoringManager,
  SpanColoringRawOptions,
  operationColoringOptions,
  serviceColoringOptions
} from '../../model/span-coloring-manager';
import {
  SpanLabellingManager,
  SpanLabellingRawOptions,
  operationLabellingOptions,
  serviceOperationLabellingOptions
} from '../../model/span-labelling-manager';
import { SpanGroupingManager } from '../../model/span-grouping/manager';
import { SpanGroupingRawOptions } from '../../model/span-grouping/span-grouping';
import { GroupLayoutType } from '../timeline/group-view';
import { Modal, ModalCloseTriggerType } from '../ui/modal/modal';
import { ModalManager } from '../ui/modal/modal-manager';
import { SpanColoringFormModalContent } from '../customization/span-coloring-form-modal-content';
import { SpanGroupingFormModalContent } from '../customization/span-grouping-form-modal-content';
import { SpanLabellingFormModalContent } from '../customization/span-labelling-form-modal-content';
import { TooltipManager } from '../ui/tooltip/tooltip-manager';
import { Trace } from '../../model/trace';
import { Stage } from '../../model/stage';

import SvgTextbox from '!!raw-loader!@mdi/svg/svg/textbox.svg';
import SvgFormatColorFill from '!!raw-loader!@mdi/svg/svg/format-color-fill.svg';
import SvgSort from '!!raw-loader!@mdi/svg/svg/sort.svg';
import SvgCursorMove from '!!raw-loader!@mdi/svg/svg/cursor-move.svg';
import SvgSelection from '!!raw-loader!@mdi/svg/svg/selection.svg';
import SvgTooltipEdit from '!!raw-loader!@mdi/svg/svg/tooltip-edit.svg';
import './timeline-wrapper.css';

const TOOLBAR_HEIGHT = 30; // TODO: Sorry :(

export class TimelineWrapper {
  readonly timeline = new Timeline();
  private stage = Stage.getSingleton();
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
      spanTooltipCustomization: document.createElement('div')
    },
    timelineContainer: document.createElement('div')
  };
  private dropdowns: {
    groupingMode: TippyInstance;
    spanLabellingMode: TippyInstance;
    spanColoringMode: TippyInstance;
    groupLayoutMode: TippyInstance;
    spanTooltipCustomization: TippyInstance;
  };

  private spanColoringMode = operationColoringOptions.key; // Do not forget to change default value of TimelineView
  private customSpanColoringFormModalContent: SpanColoringFormModalContent;
  private customSpanColoringRawOptions: SpanColoringRawOptions;

  private spanGroupingMode = processGroupingOptions.key; // Do not forget to change default value of TimelineView
  private customSpanGroupingFormModalContent: SpanGroupingFormModalContent;
  private customSpanGroupingRawOptions: SpanGroupingRawOptions;

  private spanLabellingMode = operationLabellingOptions.key; // Do not forget to change default value of TimelineView
  private customSpanLabellingFormModalContent: SpanLabellingFormModalContent;
  private customSpanLabellingRawOptions: SpanLabellingRawOptions;

  private groupLayoutMode = GroupLayoutType.COMPACT; // Do not forget to change default value of TimelineView

  private binded = {
    onSpanGroupingModeMenuItemClick: this.onSpanGroupingModeMenuItemClick.bind(
      this
    ),
    onCustomSpanGroupingModalClose: this.onCustomSpanGroupingModalClose.bind(
      this
    ),
    onSpanLabellingMenuItemClick: this.onSpanLabellingMenuItemClick.bind(this),
    onCustomSpanLabellingModalClose: this.onCustomSpanLabellingModalClose.bind(
      this
    ),
    onSpanColoringMenuItemClick: this.onSpanColoringMenuItemClick.bind(this),
    onCustomSpanColoringModalClose: this.onCustomSpanColoringModalClose.bind(
      this
    ),
    onGroupLayoutMenuItemClick: this.onGroupLayoutMenuItemClick.bind(this),
    onMoveToolClick: this.onMoveToolClick.bind(this),
    onSelectionToolClick: this.onSelectionToolClick.bind(this),
    onSpanTooltipCustomizationMultiSelectSelect: this.onSpanTooltipCustomizationMultiSelectSelect.bind(
      this
    ),
    onSpanTooltipCustomizationMultiSelectUnselect: this.onSpanTooltipCustomizationMultiSelectUnselect.bind(
      this
    ),
    onSpanTooltipCustomizationMultiSelectSearchInput: this.onSpanTooltipCustomizationMultiSelectSearchInput.bind(
      this
    )
  };

  private spanGroupingModeMenu = new WidgetToolbarSelect({
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
    onSelect: this.binded.onSpanGroupingModeMenuItemClick
  });
  private spanLabellingModeMenu = new WidgetToolbarSelect({
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
    onSelect: this.binded.onSpanLabellingMenuItemClick
  });
  private spanColoringModeMenu = new WidgetToolbarSelect({
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
    onSelect: this.binded.onSpanColoringMenuItemClick
  });
  private groupLayoutModeMenu = new WidgetToolbarSelect({
    // width: 150,
    items: [
      { type: 'item', text: 'Fill', id: GroupLayoutType.FILL },
      { type: 'item', text: 'Compact', id: GroupLayoutType.COMPACT },
      { type: 'item', text: 'Waterfall', id: GroupLayoutType.WATERFALL }
    ],
    onSelect: this.binded.onGroupLayoutMenuItemClick
  });

  private spanTooltipCustomizationMultiSelect = new WidgetToolbarMultiSelect({
    width: 200,
    maxItemContainerHeight: 125,
    showSearch: true,
    onSelect: this.binded.onSpanTooltipCustomizationMultiSelectSelect,
    onUnselect: this.binded.onSpanTooltipCustomizationMultiSelectUnselect,
    onSearchInput: this.binded.onSpanTooltipCustomizationMultiSelectSearchInput,
    items: [],
    emptyMessage: 'No Fields'
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

    btn.spanTooltipCustomization.classList.add('widget-toolbar-button');
    btn.spanTooltipCustomization.innerHTML = SvgTooltipEdit;
    rightPane.appendChild(btn.spanTooltipCustomization);
  }

  init(options: { width: number; height: number }) {
    this.timeline.init({
      width: options.width,
      height: options.height - TOOLBAR_HEIGHT
    });
    this.initTooltips();
    this.initDropdowns();

    this.updateSelectedTool();
    const btn = this.elements.toolbarBtn;
    btn.moveTool.addEventListener('click', this.binded.onMoveToolClick, false);
    btn.selectionTool.addEventListener(
      'click',
      this.binded.onSelectionToolClick,
      false
    );

    // Select default menus
    this.spanGroupingModeMenu.select(this.spanGroupingMode);
    this.spanLabellingModeMenu.select(this.spanLabellingMode);
    this.spanColoringModeMenu.select(this.spanColoringMode);
    this.groupLayoutModeMenu.select(this.groupLayoutMode);
  }

  private initTooltips() {
    const tooltipManager = TooltipManager.getSingleton();
    const btn = this.elements.toolbarBtn;
    tooltipManager.addToSingleton([
      [
        btn.moveTool,
        {
          content: 'Move Tool',
          multiple: true
        }
      ],
      [
        btn.selectionTool,
        {
          content: 'Selection/Ruler Tool',
          multiple: true
        }
      ],
      [
        btn.groupingMode,
        {
          content: 'Span Grouping',
          multiple: true
        }
      ],
      [
        btn.spanLabellingMode,
        {
          content: 'Span Labelling',
          multiple: true
        }
      ],
      [
        btn.spanColoringMode,
        {
          content: 'Span Coloring',
          multiple: true
        }
      ],
      [
        btn.groupLayoutMode,
        {
          content: 'Draw Layout',
          multiple: true
        }
      ],
      [
        btn.spanTooltipCustomization,
        {
          content: 'Customize Span Tooltip',
          multiple: true
        }
      ]
    ]);
  }

  private initDropdowns() {
    const btn = this.elements.toolbarBtn;
    this.dropdowns = {
      groupingMode: tippy(btn.groupingMode, {
        content: this.spanGroupingModeMenu.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        duration: 0,
        updateDuration: 0,
        theme: 'widget-toolbar-select',
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
        theme: 'widget-toolbar-select',
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
        theme: 'widget-toolbar-select',
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
        theme: 'widget-toolbar-select',
        trigger: 'click',
        interactive: true
      }),
      spanTooltipCustomization: tippy(btn.spanTooltipCustomization, {
        content: this.spanTooltipCustomizationMultiSelect.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        duration: 0,
        updateDuration: 0,
        theme: 'widget-toolbar-multi-select',
        trigger: 'click',
        interactive: true
      })
    };
  }

  private onMoveToolClick() {
    this.timeline.updateTool(TimelineTool.MOVE);
    this.updateSelectedTool();
  }

  private onSelectionToolClick() {
    this.timeline.updateTool(TimelineTool.SELECTION);
    this.updateSelectedTool();
  }

  private onSpanGroupingModeMenuItemClick(item: WidgetToolbarSelectItem) {
    if (item.type == 'divider') return;
    this.dropdowns.groupingMode.hide();

    if (item.id === 'manage-all') {
      // TODO
      return;
    }

    if (item.id === 'custom') {
      this.customSpanGroupingFormModalContent = new SpanGroupingFormModalContent(
        {
          rawOptions: this.customSpanGroupingRawOptions
        }
      );
      const modal = new Modal({
        content: this.customSpanGroupingFormModalContent.getElement(),
        onClose: this.binded.onCustomSpanGroupingModalClose
      });
      ModalManager.getSingleton().show(modal);
      this.customSpanGroupingFormModalContent.init(); // must be called after modal is rendered
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
    this.spanGroupingMode = item.id;
    this.spanGroupingModeMenu.select(item.id);
  }

  private onCustomSpanGroupingModalClose(
    triggerType: ModalCloseTriggerType,
    data: any
  ) {
    if (this.customSpanGroupingFormModalContent) {
      this.customSpanGroupingFormModalContent.dispose();
      this.customSpanGroupingFormModalContent = null;
    }

    if (
      triggerType != ModalCloseTriggerType.CLOSE_METHOD_CALL ||
      data.action != 'save'
    ) {
      return;
    }

    this.customSpanGroupingRawOptions = {
      key: 'custom',
      name: 'Custom',
      rawCode: data.tsCode,
      compiledCode: data.compiledJSCode
    };
    this.spanGroupingMode = 'custom';
    this.spanGroupingModeMenu.select('custom');
    this.timeline.updateSpanGrouping({
      key: 'custom',
      name: 'Custom',
      groupBy: data.groupBy
    });
  }

  private onSpanLabellingMenuItemClick(item: WidgetToolbarSelectItem) {
    if (item.type == 'divider') return;
    this.dropdowns.spanLabellingMode.hide();

    if (item.id === 'manage-all') {
      // TODO
      return;
    }

    if (item.id === 'custom') {
      this.customSpanLabellingFormModalContent = new SpanLabellingFormModalContent(
        {
          rawOptions: this.customSpanLabellingRawOptions
        }
      );
      const modal = new Modal({
        content: this.customSpanLabellingFormModalContent.getElement(),
        onClose: this.binded.onCustomSpanLabellingModalClose
      });
      ModalManager.getSingleton().show(modal);
      this.customSpanLabellingFormModalContent.init(); // must be called after modal is rendered
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
    this.spanLabellingMode = item.id;
    this.spanLabellingModeMenu.select(item.id);
  }

  private onCustomSpanLabellingModalClose(
    triggerType: ModalCloseTriggerType,
    data: any
  ) {
    if (this.customSpanLabellingFormModalContent) {
      this.customSpanLabellingFormModalContent.dispose();
      this.customSpanLabellingFormModalContent = null;
    }

    if (
      triggerType != ModalCloseTriggerType.CLOSE_METHOD_CALL ||
      data.action != 'save'
    ) {
      return;
    }

    this.customSpanLabellingRawOptions = {
      key: 'custom',
      name: 'Custom',
      rawCode: data.tsCode,
      compiledCode: data.compiledJSCode
    };
    this.spanLabellingMode = 'custom';
    this.spanLabellingModeMenu.select('custom');
    this.timeline.updateSpanLabelling({
      key: 'custom',
      name: 'Custom',
      labelBy: data.labelBy
    });
  }

  private onSpanColoringMenuItemClick(item: WidgetToolbarSelectItem) {
    if (item.type == 'divider') return;
    this.dropdowns.spanColoringMode.hide();

    if (item.id === 'manage-all') {
      // TODO
      return;
    }

    if (item.id === 'custom') {
      this.customSpanColoringFormModalContent = new SpanColoringFormModalContent(
        {
          rawOptions: this.customSpanColoringRawOptions
        }
      );
      const modal = new Modal({
        content: this.customSpanColoringFormModalContent.getElement(),
        onClose: this.binded.onCustomSpanColoringModalClose
      });
      ModalManager.getSingleton().show(modal);
      this.customSpanColoringFormModalContent.init(); // must be called after modal is rendered
      return;
    }

    const spanColoringOptions = SpanColoringManager.getSingleton().getOptions(
      item.id
    );
    if (!spanColoringOptions) {
      // TODO:
      // message.error(`Unknown span coloring: "${item.id}"`);
      return;
    }

    this.timeline.updateSpanColoring(spanColoringOptions);
    this.spanColoringMode = item.id;
    this.spanColoringModeMenu.select(item.id);
  }

  private onCustomSpanColoringModalClose(
    triggerType: ModalCloseTriggerType,
    data: any
  ) {
    if (this.customSpanColoringFormModalContent) {
      this.customSpanColoringFormModalContent.dispose();
      this.customSpanColoringFormModalContent = null;
    }

    if (
      triggerType != ModalCloseTriggerType.CLOSE_METHOD_CALL ||
      data.action != 'save'
    ) {
      return;
    }

    this.customSpanColoringRawOptions = {
      key: 'custom',
      name: 'Custom',
      rawCode: data.tsCode,
      compiledCode: data.compiledJSCode
    };
    this.spanColoringMode = 'custom';
    this.spanColoringModeMenu.select('custom');
    this.timeline.updateSpanColoring({
      key: 'custom',
      name: 'Custom',
      colorBy: data.colorBy
    });
  }

  private onGroupLayoutMenuItemClick(item: WidgetToolbarSelectItem) {
    if (item.type == 'divider') return;
    this.timeline.updateGroupLayoutMode(item.id as GroupLayoutType);
    this.groupLayoutModeMenu.select(item.id);
    this.dropdowns.groupLayoutMode.hide();
  }

  private onSpanTooltipCustomizationMultiSelectSelect(
    item: WidgetToolbarMultiSelectItem
  ) {
    this.spanTooltipCustomizationMultiSelect.select(item.id);

    const spanTooltipContent = this.timeline.getSpanTooltipContent();
    const options = spanTooltipContent.getOptions();
    if (item.id == 'serviceName') {
      spanTooltipContent.setShowServiceName(true);
    } else if (item.id == 'nearbyLogs') {
      spanTooltipContent.setShowNearbyLogs(true);
    } else if (item.id.indexOf('tag.') == 0) {
      const tag = item.id.replace('tag.', '');
      const newTags = options.spanTagsToShow.slice();
      if (newTags.indexOf(tag) == -1) {
        newTags.push(tag);
        spanTooltipContent.setSpanTagsToShow(newTags);
      }
    } else if (item.id.indexOf('process.tag.') == 0) {
      const tag = item.id.replace('process.tag.', '');
      const newTags = options.processTagsToShow.slice();
      if (newTags.indexOf(tag) == -1) {
        newTags.push(tag);
        spanTooltipContent.setProcessTagsToShow(newTags);
      }
    } else {
      console.warn(`Unknown span tooltip field: "${item.id}"`);
    }
  }

  private onSpanTooltipCustomizationMultiSelectUnselect(
    item: WidgetToolbarMultiSelectItem
  ) {
    this.spanTooltipCustomizationMultiSelect.unselect(item.id);

    const spanTooltipContent = this.timeline.getSpanTooltipContent();
    const options = spanTooltipContent.getOptions();
    if (item.id == 'serviceName') {
      spanTooltipContent.setShowServiceName(false);
    } else if (item.id == 'nearbyLogs') {
      spanTooltipContent.setShowNearbyLogs(false);
    } else if (item.id.indexOf('tag.') == 0) {
      const tag = item.id.replace('tag.', '');
      const newTags = options.spanTagsToShow.slice();
      if (newTags.indexOf(tag) > -1) {
        newTags.splice(newTags.indexOf(tag), 1);
        spanTooltipContent.setSpanTagsToShow(newTags);
      }
    } else if (item.id.indexOf('process.tag.') == 0) {
      const tag = item.id.replace('process.tag.', '');
      const newTags = options.processTagsToShow.slice();
      if (newTags.indexOf(tag) > -1) {
        newTags.splice(newTags.indexOf(tag), 1);
        spanTooltipContent.setProcessTagsToShow(newTags);
      }
    } else {
      console.warn(`Unknown span tooltip field: "${item.id}"`);
    }
  }

  private onSpanTooltipCustomizationMultiSelectSearchInput() {
    // Probably height of the multi-select is changed,
    // if tippy is forced to render top position, this breaks the
    // arrow positioning. This is a workaround for updating its
    // position again
    this.dropdowns.spanTooltipCustomization.popperInstance.update();
  }

  private updateSelectedTool() {
    const btn = this.elements.toolbarBtn;
    const toolButtons = {
      [TimelineTool.MOVE]: btn.moveTool,
      [TimelineTool.SELECTION]: btn.selectionTool
    };
    Object.values(toolButtons).forEach(el => el.classList.remove('selected'));
    const selectedTool = toolButtons[this.timeline.tool];
    selectedTool && selectedTool.classList.add('selected');
  }

  private updateSpanTooltipCustomizationMultiSelect() {
    const tooltipOptions = this.timeline.getSpanTooltipContent().getOptions();
    const items: WidgetToolbarMultiSelectItem[] = [
      {
        id: 'serviceName',
        text: 'Service Name',
        selected: tooltipOptions.showServiceName
      },
      {
        id: 'nearbyLogs',
        text: 'Nearby Logs',
        selected: tooltipOptions.showNearbyLogs
      }
    ];

    Object.keys(this.stage.getAllSpanTags()).forEach(tag => {
      items.push({
        id: `tag.${tag}`,
        text: `tag.${tag}`,
        category: 'Span Tags'
      });
    });

    Object.keys(this.stage.getAllProcessTags()).forEach(tag => {
      items.push({
        id: `process.tag.${tag}`,
        text: `process.tag.${tag}`,
        category: 'Process Tags'
      });
    });

    this.spanTooltipCustomizationMultiSelect.updateItems(items);
  }

  addTrace(trace: Trace) {
    this.timeline.addTrace(trace);
    this.updateSpanTooltipCustomizationMultiSelect();
  }

  removeTrace(trace: Trace) {
    this.timeline.removeTrace(trace);
    this.updateSpanTooltipCustomizationMultiSelect();
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
    const tooltipManager = TooltipManager.getSingleton();
    const btn = this.elements.toolbarBtn;
    tooltipManager.removeFromSingleton([
      btn.moveTool,
      btn.selectionTool,
      btn.groupingMode,
      btn.spanLabellingMode,
      btn.spanColoringMode,
      btn.groupLayoutMode,
      btn.spanTooltipCustomization
    ]);

    for (let tippy of Object.values(this.dropdowns)) {
      tippy.destroy();
    }
    this.dropdowns = null;

    btn.moveTool.removeEventListener(
      'click',
      this.binded.onMoveToolClick,
      false
    );
    btn.selectionTool.removeEventListener(
      'click',
      this.binded.onSelectionToolClick,
      false
    );

    this.spanGroupingModeMenu.dispose();
    this.groupLayoutModeMenu.dispose();
    this.spanColoringModeMenu.dispose();
    this.spanLabellingModeMenu.dispose();

    // TODO
  }
}
