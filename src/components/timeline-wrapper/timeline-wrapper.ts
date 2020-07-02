import { TimelineView, TimelineTool } from '../timeline/timeline-view';
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
  serviceColoringOptions,
  selfTimeColoringOptions
} from '../../model/span-coloring-manager';
import {
  SpanLabellingManager,
  SpanLabellingRawOptions,
  operationLabellingOptions,
  serviceOperationLabellingOptions
} from '../../model/span-labelling-manager';
import { SpanGroupingManager } from '../../model/span-grouping/manager';
import { SpanGroupingRawOptions } from '../../model/span-grouping/span-grouping';
import { SpanGroupLayoutType } from '../timeline/span-group-view';
import { Modal, ModalCloseTriggerType } from '../ui/modal/modal';
import { ModalManager } from '../ui/modal/modal-manager';
import { SpanColoringFormModalContent } from '../customization/span-coloring-form-modal-content';
import { SpanGroupingFormModalContent } from '../customization/span-grouping-form-modal-content';
import { SpanLabellingFormModalContent } from '../customization/span-labelling-form-modal-content';
import { TooltipManager } from '../ui/tooltip/tooltip-manager';
import { Trace } from '../../model/trace';
import { Stage } from '../../model/stage';
import { clipboard } from 'electron';
import Noty from 'noty';
import { convertFromJaegerTrace } from '../../model/jaeger';

import SvgTextbox from '!!raw-loader!@mdi/svg/svg/textbox.svg';
import SvgFormatColorFill from '!!raw-loader!@mdi/svg/svg/format-color-fill.svg';
import SvgSort from '!!raw-loader!@mdi/svg/svg/sort.svg';
import SvgCursorMove from '!!raw-loader!@mdi/svg/svg/cursor-move.svg';
import SvgRuler from '!!raw-loader!@mdi/svg/svg/ruler-square.svg';
import SvgTooltipEdit from '!!raw-loader!@mdi/svg/svg/tooltip-edit.svg';
import SvgDatabase from '!!raw-loader!@mdi/svg/svg/database.svg';
import SvgSatellite from '!!raw-loader!@mdi/svg/svg/satellite-uplink.svg';
import './timeline-wrapper.css';

const TOOLBAR_HEIGHT = 30;

export class TimelineWrapper {
  readonly timeline = new TimelineView();
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
    timelineContainer: document.createElement('div'),
    emptyMessage: {
      container: document.createElement('div'),
      sampleTraceButtonHotrod: document.createElement('span'),
      sampleTraceButtonRaftConsensus: document.createElement('span')
    }
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

  private groupLayoutMode = SpanGroupLayoutType.COMPACT; // Do not forget to change default value of TimelineView

  private timelineToolBeforeTemporarySwitchToRulerTool: TimelineTool;

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
    onKeyUp: this.onKeyUp.bind(this),
    onSampleTraceButtonHotrodClick: this.onSampleTraceButtonHotrodClick.bind(
      this
    ),
    onSampleTraceButtonRaftConcensusClick: this.onSampleTraceButtonRaftConcensusClick.bind(
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
      { type: 'item', text: 'Self Time', id: selfTimeColoringOptions.key },
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
      { type: 'item', text: 'Fill', id: SpanGroupLayoutType.FILL },
      { type: 'item', text: 'Compact', id: SpanGroupLayoutType.COMPACT },
      { type: 'item', text: 'Waterfall', id: SpanGroupLayoutType.WATERFALL }
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
    timelineContainer.classList.add('timeline-container');
    container.appendChild(timelineContainer);
    this.prepareToolbar();
    this.prepareEmptyMessage();
    this.timeline.mount(timelineContainer);
  }

  private prepareEmptyMessage() {
    const { timelineContainer, emptyMessage } = this.elements;
    emptyMessage.container.classList.add('empty-message-container');

    const innerContainer = document.createElement('div');
    emptyMessage.container.appendChild(innerContainer);

    const dragDropText = document.createElement('div');
    dragDropText.classList.add('drag-drop-text');
    dragDropText.innerHTML = `• Drag & drop JSON files exported from Jaeger, Zipkin, or Stalk Studio.`;
    innerContainer.appendChild(dragDropText);

    const dataSourcesText = document.createElement('div');
    dataSourcesText.classList.add('data-sources-text');
    dataSourcesText.innerHTML = `• Use Data Sources ${SvgDatabase} to search traces in Jaeger and Zipkin services.`;
    innerContainer.appendChild(dataSourcesText);

    const liveCollectorText = document.createElement('div');
    liveCollectorText.classList.add('live-collector-text');
    liveCollectorText.innerHTML = `• Use Live Collector ${SvgSatellite} to collect traces directly from Jaeger and Zipkin instrumentations.`;
    innerContainer.appendChild(liveCollectorText);

    const sampleTraceText = document.createElement('div');
    sampleTraceText.classList.add('sample-trace-text');
    sampleTraceText.appendChild(
      document.createTextNode(
        '• Load some example traces to get started easily: '
      )
    );

    emptyMessage.sampleTraceButtonHotrod.classList.add(
      'add-sample-trace-button'
    );
    emptyMessage.sampleTraceButtonHotrod.textContent = 'jaeger/hotrod';
    emptyMessage.sampleTraceButtonHotrod.addEventListener(
      'click',
      this.binded.onSampleTraceButtonHotrodClick,
      false
    );
    sampleTraceText.appendChild(emptyMessage.sampleTraceButtonHotrod);

    sampleTraceText.appendChild(document.createTextNode(', '));

    emptyMessage.sampleTraceButtonRaftConsensus.classList.add(
      'add-sample-trace-button'
    );
    emptyMessage.sampleTraceButtonRaftConsensus.textContent = 'raft-consensus';
    emptyMessage.sampleTraceButtonRaftConsensus.addEventListener(
      'click',
      this.binded.onSampleTraceButtonRaftConcensusClick,
      false
    );
    sampleTraceText.appendChild(emptyMessage.sampleTraceButtonRaftConsensus);

    innerContainer.appendChild(sampleTraceText);

    timelineContainer.appendChild(emptyMessage.container);
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

  // can throw
  // - this.timeline.addTrace
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
    this.stage.getAllTraces().forEach(trace => this.addTrace(trace));
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

      case 'w': {
        this.timeline.translateY(10);
        return;
      }

      case 'a': {
        this.timeline.translateX(10);
        return;
      }

      case 's': {
        this.timeline.translateY(-10);
        return;
      }

      case 'd': {
        this.timeline.translateX(-10);
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
        onClose: this.binded.onCustomSpanGroupingModalClose,
        shouldAutoFocusFirstElement: true
      });
      ModalManager.getSingleton().show(modal);
      this.customSpanGroupingFormModalContent.init(); // must be called after modal is rendered
      return;
    }

    const spanGroupingOptions = SpanGroupingManager.getSingleton().getOptions(
      item.id
    );
    if (!spanGroupingOptions) {
      new Noty({
        text: `Unknown span grouping: "${item.id}"`,
        type: 'error'
      }).show();
      return;
    }

    try {
      this.timeline.updateSpanGrouping(spanGroupingOptions);
      this.spanGroupingMode = item.id;
      this.spanGroupingModeMenu.select(item.id);
    } catch (err) {
      console.error(err);
      new Noty({
        text:
          `Unexpected error while grouping spans or layout: "${err.message} <br /><br />"` +
          `Please check your console for further details. Press Cmd+Option+I or Ctrl+Option+I to ` +
          `open devtools.`,
        type: 'error'
      }).show();
    }
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

    try {
      this.timeline.updateSpanGrouping({
        key: 'custom',
        name: 'Custom',
        groupBy: data.groupBy
      });
      this.spanGroupingMode = 'custom';
      this.spanGroupingModeMenu.select('custom');
    } catch (err) {
      console.error(err);
      new Noty({
        text:
          `Unexpected error while grouping spans or layout: "${err.message} <br /><br />"` +
          `Please check your console for further details. Press Cmd+Option+I or Ctrl+Option+I to ` +
          `open devtools.`,
        type: 'error'
      }).show();
    }
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
        onClose: this.binded.onCustomSpanLabellingModalClose,
        shouldAutoFocusFirstElement: true
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

    try {
      this.timeline.updateSpanLabelling(spanLabellingOptions);
      this.spanLabellingMode = item.id;
      this.spanLabellingModeMenu.select(item.id);
    } catch (err) {
      console.error(err);
      new Noty({
        text:
          `Unexpected error while labelling spans: "${err.message} <br /><br />"` +
          `Please check your console for further details. Press Cmd+Option+I or Ctrl+Option+I to ` +
          `open devtools.`,
        type: 'error'
      });
    }
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

    try {
      this.timeline.updateSpanLabelling({
        key: 'custom',
        name: 'Custom',
        labelBy: data.labelBy
      });
      this.spanLabellingMode = 'custom';
      this.spanLabellingModeMenu.select('custom');
    } catch (err) {
      console.error(err);
      new Noty({
        text:
          `Unexpected error while labelling spans: "${err.message} <br /><br />"` +
          `Please check your console for further details. Press Cmd+Option+I or Ctrl+Option+I to ` +
          `open devtools.`,
        type: 'error'
      });
    }
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
        onClose: this.binded.onCustomSpanColoringModalClose,
        shouldAutoFocusFirstElement: true
      });
      ModalManager.getSingleton().show(modal);
      this.customSpanColoringFormModalContent.init(); // must be called after modal is rendered
      return;
    }

    const spanColoringOptions = SpanColoringManager.getSingleton().getOptions(
      item.id
    );
    if (!spanColoringOptions) {
      new Noty({
        text: ` Unknown span coloring: "${item.id}"`,
        type: 'error'
      });
      return;
    }

    try {
      this.timeline.updateSpanColoring(spanColoringOptions);
      this.spanColoringMode = item.id;
      this.spanColoringModeMenu.select(item.id);
    } catch (err) {
      console.error(err);
      new Noty({
        text:
          `Unexpected error while coloring spans: "${err.message} <br /><br />"` +
          `Please check your console for further details. Press Cmd+Option+I or Ctrl+Option+I to ` +
          `open devtools.`,
        type: 'error'
      }).show();
    }
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

    try {
      this.timeline.updateSpanColoring({
        key: 'custom',
        name: 'Custom',
        colorBy: data.colorBy
      });
      this.spanColoringMode = 'custom';
      this.spanColoringModeMenu.select('custom');
    } catch (err) {
      console.error(err);
      new Noty({
        text:
          `Unexpected error while coloring spans: "${err.message} <br /><br />"` +
          `Please check your console for further details. Press Cmd+Option+I or Ctrl+Option+I to ` +
          `open devtools.`,
        type: 'error'
      }).show();
    }
  }

  private onGroupLayoutMenuItemClick(item: WidgetToolbarSelectItem) {
    if (item.type == 'divider') return;
    this.timeline.updateGroupLayoutMode(item.id as SpanGroupLayoutType);
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
    selectedTool?.classList.add('selected');
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

    this.spanTooltipCustomizationMultiSelect.updateItems(items);
  }

  private async onSampleTraceButtonHotrodClick(e: MouseEvent) {
    const hotrod = await import(
      /* webpackChunkName: "hotrod" */ '../../../mock/jaeger-hotrod.json'
    );
    const spans = convertFromJaegerTrace(hotrod.default.data[0]);
    const trace = new Trace(spans);
    this.stage.addTrace(trace);
  }

  private async onSampleTraceButtonRaftConcensusClick(e: MouseEvent) {
    const raftConsensus = await import(
      /* webpackChunkName: "raft-consensus" */ '../../../mock/stalk-stage-2020-05-10--12-48-55.json'
    );
    raftConsensus.default.traces.forEach((spans: any) => {
      const trace = new Trace(spans);
      this.stage.addTrace(trace);
    });
  }

  addTrace(trace: Trace) {
    try {
      this.timeline.addTrace(trace);
      this.updateSpanTooltipCustomizationMultiSelect();
      this.elements.emptyMessage.container.style.display =
        this.timeline.getTraces().length > 0 ? 'none' : '';
    } catch (err) {
      console.error(err);
      new Noty({
        text:
          `Unexpected error while adding trace: "${err.message} <br /><br />"` +
          `Please check your console for further details. Press Cmd+Option+I or Ctrl+Option+I to ` +
          `open devtools.`,
        type: 'error'
      }).show();
    }
  }

  removeTrace(trace: Trace) {
    try {
      this.timeline.removeTrace(trace);
      this.updateSpanTooltipCustomizationMultiSelect();
      this.elements.emptyMessage.container.style.display =
        this.timeline.getTraces().length > 0 ? 'none' : '';
    } catch (err) {
      console.error(err);
      new Noty({
        text:
          `Unexpected error while adding trace: "${err.message} <br /><br />"` +
          `Please check your console for further details. Press Cmd+Option+I or Ctrl+Option+I to ` +
          `open devtools.`,
        type: 'error'
      }).show();
    }
  }

  mount(parentEl: HTMLElement) {
    parentEl.appendChild(this.elements.container);
  }

  unmount() {
    const parent = this.elements.container.parentElement;
    parent?.removeChild(this.elements.container);
  }

  resize(width: number, height: number) {
    this.timeline.resize(width, height - TOOLBAR_HEIGHT);
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
    const { emptyMessage } = this.elements;

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
    emptyMessage.sampleTraceButtonHotrod.removeEventListener(
      'click',
      this.binded.onSampleTraceButtonHotrodClick,
      false
    );
    emptyMessage.sampleTraceButtonRaftConsensus.removeEventListener(
      'click',
      this.binded.onSampleTraceButtonRaftConcensusClick,
      false
    );

    this.spanGroupingModeMenu.dispose();
    this.groupLayoutModeMenu.dispose();
    this.spanColoringModeMenu.dispose();
    this.spanLabellingModeMenu.dispose();
  }
}
