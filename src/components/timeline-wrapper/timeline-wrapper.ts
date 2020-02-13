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
import { clipboard } from 'electron';
import * as opentracing from 'opentracing';
import { OperationNamePrefix } from '../../utils/self-tracing/opname-prefix-decorator';
import { Stalk, NewTrace, ChildOf, FollowsFrom } from '../../utils/self-tracing/trace-decorator';

import SvgTextbox from '!!raw-loader!@mdi/svg/svg/textbox.svg';
import SvgFormatColorFill from '!!raw-loader!@mdi/svg/svg/format-color-fill.svg';
import SvgSort from '!!raw-loader!@mdi/svg/svg/sort.svg';
import SvgCursorMove from '!!raw-loader!@mdi/svg/svg/cursor-move.svg';
import SvgRuler from '!!raw-loader!@mdi/svg/svg/ruler-square.svg';
import SvgTooltipEdit from '!!raw-loader!@mdi/svg/svg/tooltip-edit.svg';
import './timeline-wrapper.css';

const TOOLBAR_HEIGHT = 30; // TODO: Sorry :(

@OperationNamePrefix('timeline-wrapper.')
export class TimelineWrapper {
  readonly timeline = new Timeline();
  private stage = Stage.getSingleton();
  private elements = {
    container: document.createElement('div'),
    toolbar: document.createElement('div'),
    toolbarBtn: {
      moveTool: document.createElement('div'),
      rulerTool: document.createElement('div'),
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

  private timelineToolBeforeTemporarySwitchToRulerTool: TimelineTool;

  private binded = {
    onSpanGroupingModeMenuItemClick: this.onSpanGroupingModeMenuItemClick.bind(
      this, null
    ),
    onCustomSpanGroupingModalClose: this.onCustomSpanGroupingModalClose.bind(
      this, null
    ),
    onSpanLabellingMenuItemClick: this.onSpanLabellingMenuItemClick.bind(this, null),
    onCustomSpanLabellingModalClose: this.onCustomSpanLabellingModalClose.bind(
      this, null
    ),
    onSpanColoringMenuItemClick: this.onSpanColoringMenuItemClick.bind(this, null),
    onCustomSpanColoringModalClose: this.onCustomSpanColoringModalClose.bind(
      this, null
    ),
    onGroupLayoutMenuItemClick: this.onGroupLayoutMenuItemClick.bind(this, null),
    onMoveToolClick: this.onMoveToolClick.bind(this),
    onRulerToolClick: this.onRulerToolClick.bind(this),
    onSpanTooltipCustomizationMultiSelectSelect: this.onSpanTooltipCustomizationMultiSelectSelect.bind(
      this
    ),
    onSpanTooltipCustomizationMultiSelectUnselect: this.onSpanTooltipCustomizationMultiSelectUnselect.bind(
      this
    ),
    onSpanTooltipCustomizationMultiSelectSearchInput: this.onSpanTooltipCustomizationMultiSelectSearchInput.bind(
      this
    ),
    onKeyDown: this.onKeyDown.bind(this),
    onKeyUp: this.onKeyUp.bind(this)
  };

  private spanGroupingModeMenu = new WidgetToolbarSelect({
    // width: 150,
    items: [
      { type: 'item', text: 'Trace', id: traceGroupingOptions.key },
      { type: 'item', text: 'Process', id: processGroupingOptions.key },
      { type: 'item', text: 'Service', id: serviceNameGroupingOptions.key },
      { type: 'divider' },
      { type: 'item', text: 'Custom', icon: 'code-tags', id: 'custom' }
      // {
      //   type: 'item',
      //   text: 'Manage All',
      //   icon: 'settings-outline',
      //   id: 'manage-all',
      //   disabled: true
      // }
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
      { type: 'item', text: 'Custom', icon: 'code-tags', id: 'custom' }
      // {
      //   type: 'item',
      //   text: 'Manage All',
      //   icon: 'settings-outline',
      //   id: 'manage-all',
      //   disabled: true
      // }
    ],
    onSelect: this.binded.onSpanLabellingMenuItemClick
  });
  private spanColoringModeMenu = new WidgetToolbarSelect({
    // width: 150,
    items: [
      { type: 'item', text: 'Operation', id: operationColoringOptions.key },
      { type: 'item', text: 'Service', id: serviceColoringOptions.key },
      { type: 'divider' },
      { type: 'item', text: 'Custom', icon: 'code-tags', id: 'custom' }
      // {
      //   type: 'item',
      //   text: 'Manage All',
      //   icon: 'settings-outline',
      //   id: 'manage-all',
      //   disabled: true
      // }
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
    container.setAttribute('tabindex', '-1');
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

    btn.rulerTool.classList.add('widget-toolbar-button');
    btn.rulerTool.innerHTML = SvgRuler;
    leftPane.appendChild(btn.rulerTool);

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

  @Stalk({ handler: ChildOf })
  init(ctx: opentracing.Span, options: { width: number; height: number }) {
    this.timeline.init(ctx, {
      width: options.width,
      height: options.height - TOOLBAR_HEIGHT
    });
    this.initTooltips(ctx);
    this.initDropdowns(ctx);

    this.updateSelectedTool();
    const btn = this.elements.toolbarBtn;
    btn.moveTool.addEventListener('click', this.binded.onMoveToolClick, false);
    btn.rulerTool.addEventListener(
      'click',
      this.binded.onRulerToolClick,
      false
    );

    // Select default menus
    this.spanGroupingModeMenu.select(this.spanGroupingMode);
    this.spanLabellingModeMenu.select(this.spanLabellingMode);
    this.spanColoringModeMenu.select(this.spanColoringMode);
    this.groupLayoutModeMenu.select(this.groupLayoutMode);

    // Bind events
    this.elements.container.addEventListener(
      'keydown',
      this.binded.onKeyDown,
      false
    );
    this.elements.container.addEventListener(
      'keyup',
      this.binded.onKeyUp,
      false
    );

    // Initial data
    this.stage.getAllTraces().forEach(trace => this.timeline.addTrace(ctx, trace));
  }

  @Stalk({ handler: ChildOf })
  private initTooltips(ctx: opentracing.Span) {
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
        btn.rulerTool,
        {
          content: 'Ruler Tool',
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

  @Stalk({ handler: ChildOf })
  private initDropdowns(ctx: opentracing.Span) {
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

  private onKeyDown(e: KeyboardEvent) {
    // If user is typing on any kind of input element which is
    // child of this component, we don't want to trigger shortcuts
    if (e.target != this.elements.container) return;

    switch (e.key) {
      case 'f': {
        const selectedSpanId = this.timeline.getSelectedSpanId();
        if (!selectedSpanId) return;
        this.timeline.focusSpans([selectedSpanId]);
        return;
      }

      case 'c': {
        if (!(e.ctrlKey || e.metaKey)) return;
        const selectedSpanId = this.timeline.getSelectedSpanId();
        if (!selectedSpanId) return;
        const span = this.stage.getMainSpanGroup().get(selectedSpanId);
        if (!span) return;
        clipboard.writeText(JSON.stringify(span, null, 4));
        return;
      }

      case 'Alt': {
        if (this.timeline.tool == TimelineTool.RULER) return;
        this.timelineToolBeforeTemporarySwitchToRulerTool = this.timeline.tool;
        this.timeline.updateTool(TimelineTool.RULER);
        this.updateSelectedTool();
        return;
      }
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    // If user is typing on any kind of input element which is
    // child of this component, we don't want to trigger shortcuts
    if (e.target != this.elements.container) return;

    switch (e.key) {
      case 'Alt': {
        if (this.timelineToolBeforeTemporarySwitchToRulerTool) {
          this.timeline.updateTool(
            this.timelineToolBeforeTemporarySwitchToRulerTool
          );
          this.timelineToolBeforeTemporarySwitchToRulerTool = null;
          this.updateSelectedTool();
        }
        return;
      }
    }
  }

  private onMoveToolClick() {
    this.timeline.updateTool(TimelineTool.MOVE);
    this.updateSelectedTool();
  }

  private onRulerToolClick() {
    this.timeline.updateTool(TimelineTool.RULER);
    this.updateSelectedTool();
  }

  @Stalk({ handler: NewTrace })
  private onSpanGroupingModeMenuItemClick(ctx: opentracing.Span, item: WidgetToolbarSelectItem) {
    ctx.addTags({
      itemType: item.type,
      itemId: (item as any).id,
      itemText: (item as any).text,
    });
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
      // TODO: Show error
      // message.error(`Unknown span grouping: "${item.id}"`);
      return;
    }

    this.timeline.updateSpanGrouping(ctx, spanGroupingOptions);
    this.spanGroupingMode = item.id;
    this.spanGroupingModeMenu.select(item.id);
  }

  @Stalk({ handler: NewTrace })
  private onCustomSpanGroupingModalClose(
    ctx: opentracing.Span,
    triggerType: ModalCloseTriggerType,
    data: any
  ) {
    ctx.addTags({ triggerType, tsCode: data.tsCode, compiledJSCode: data.compiledJSCode });

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
    this.timeline.updateSpanGrouping(ctx, {
      key: 'custom',
      name: 'Custom',
      groupBy: data.groupBy
    });
  }

  @Stalk({ handler: NewTrace })
  private onSpanLabellingMenuItemClick(ctx: opentracing.Span, item: WidgetToolbarSelectItem) {
    ctx.addTags({
      itemType: item.type,
      itemId: (item as any).id,
      itemText: (item as any).text,
    });
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

    this.timeline.updateSpanLabelling(ctx, spanLabellingOptions);
    this.spanLabellingMode = item.id;
    this.spanLabellingModeMenu.select(item.id);
  }

  @Stalk({ handler: NewTrace })
  private onCustomSpanLabellingModalClose(
    ctx: opentracing.Span,
    triggerType: ModalCloseTriggerType,
    data: any
  ) {
    ctx.addTags({ triggerType, tsCode: data.tsCode, compiledJSCode: data.compiledJSCode });

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
    this.timeline.updateSpanLabelling(ctx, {
      key: 'custom',
      name: 'Custom',
      labelBy: data.labelBy
    });
  }

  @Stalk({ handler: NewTrace })
  private onSpanColoringMenuItemClick(ctx: opentracing.Span, item: WidgetToolbarSelectItem) {
    ctx.addTags({
      itemType: item.type,
      itemId: (item as any).id,
      itemText: (item as any).text,
    });
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

    this.timeline.updateSpanColoring(ctx, spanColoringOptions);
    this.spanColoringMode = item.id;
    this.spanColoringModeMenu.select(item.id);
  }

  @Stalk({ handler: NewTrace })
  private onCustomSpanColoringModalClose(
    ctx: opentracing.Span,
    triggerType: ModalCloseTriggerType,
    data: any
  ) {
    ctx.addTags({ triggerType, tsCode: data.tsCode, compiledJSCode: data.compiledJSCode });

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
    this.timeline.updateSpanColoring(ctx, {
      key: 'custom',
      name: 'Custom',
      colorBy: data.colorBy
    });
  }

  @Stalk({ handler: NewTrace })
  private onGroupLayoutMenuItemClick(ctx: opentracing.Span, item: WidgetToolbarSelectItem) {
    ctx.addTags({
      itemType: item.type,
      itemId: (item as any).id,
      itemText: (item as any).text
    });
    if (item.type == 'divider') return;
    this.timeline.updateGroupLayoutMode(ctx, item.id as GroupLayoutType);
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
      [TimelineTool.RULER]: btn.rulerTool
    };
    Object.values(toolButtons).forEach(el => el.classList.remove('selected'));
    const selectedTool = toolButtons[this.timeline.tool];
    selectedTool && selectedTool.classList.add('selected');
  }

  @Stalk({ handler: ChildOf })
  private updateSpanTooltipCustomizationMultiSelect(ctx: opentracing.Span) {
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

    const allSpanTagKeys = Object.keys(this.stage.getAllSpanTags());
    allSpanTagKeys.forEach(tag => {
      items.push({
        id: `tag.${tag}`,
        text: `tag.${tag}`,
        category: 'Span Tags'
      });
    });

    const allProcessTagKeys = Object.keys(this.stage.getAllProcessTags());
    allProcessTagKeys.forEach(tag => {
      items.push({
        id: `process.tag.${tag}`,
        text: `process.tag.${tag}`,
        category: 'Process Tags'
      });
    });

    ctx.addTags({
      allSpanTagKeysCount: allSpanTagKeys.length,
      allProcessTagKeysCount: allProcessTagKeys.length
    });

    this.spanTooltipCustomizationMultiSelect.updateItems(items);
  }

  @Stalk({ handler: ChildOf })
  addTrace(ctx: opentracing.Span, trace: Trace) {
    this.timeline.addTrace(ctx, trace);
    this.updateSpanTooltipCustomizationMultiSelect(ctx);
  }

  @Stalk({ handler: ChildOf })
  removeTrace(ctx: opentracing.Span, trace: Trace) {
    this.timeline.removeTrace(ctx, trace);
    this.updateSpanTooltipCustomizationMultiSelect(ctx);
  }

  mount(parentEl: HTMLElement) {
    parentEl.appendChild(this.elements.container);
  }

  unmount() {
    const parent = this.elements.container.parentElement;
    parent && parent.removeChild(this.elements.container);
  }

  @Stalk({ handler: ChildOf })
  resize(ctx: opentracing.Span, width: number, height: number) {
    this.timeline.resize(ctx, width, height - TOOLBAR_HEIGHT);
  }

  dispose() {
    const tooltipManager = TooltipManager.getSingleton();
    const btn = this.elements.toolbarBtn;
    tooltipManager.removeFromSingleton([
      btn.moveTool,
      btn.rulerTool,
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

    this.elements.container.removeEventListener(
      'keydown',
      this.binded.onKeyDown,
      false
    );
    this.elements.container.removeEventListener(
      'keyup',
      this.binded.onKeyUp,
      false
    );

    btn.moveTool.removeEventListener(
      'click',
      this.binded.onMoveToolClick,
      false
    );
    btn.rulerTool.removeEventListener(
      'click',
      this.binded.onRulerToolClick,
      false
    );

    this.spanGroupingModeMenu.dispose();
    this.groupLayoutModeMenu.dispose();
    this.spanColoringModeMenu.dispose();
    this.spanLabellingModeMenu.dispose();

    // TODO
  }
}
