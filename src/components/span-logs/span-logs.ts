import Fuse from 'fuse.js';
import { Stage, StageEvent } from '../../model/stage';
import debounce from 'lodash/debounce';
import { TimelineView, TimelineViewEvent } from '../timeline/timeline-view';
import {
  SpansTableView,
  SpansTableViewEvent,
} from '../spans-table/spans-table';
import { SpanLogItemView } from './span-log-item';
import { TooltipManager } from '../ui/tooltip/tooltip-manager';
import { createElementFromHTML } from '../../utils/create-element';

import SvgMagnify from '!!raw-loader!@mdi/svg/svg/magnify.svg';
import SvgCursorDefaultClick from '!!raw-loader!@mdi/svg/svg/cursor-default-click-outline.svg';
import SvgEmoticonSad from '!!raw-loader!@mdi/svg/svg/emoticon-sad-outline.svg';
import SvgExpandAll from '!!raw-loader!@mdi/svg/svg/expand-all.svg';
import SvgCollapseAll from '!!raw-loader!@mdi/svg/svg/collapse-all.svg';
import '../ui/widget-toolbar/widget-toolbar.css';
import './span-logs.css';

export class SpanLogsView {
  private stage = Stage.getSingleton();
  private timeline: TimelineView;
  private spansTable: SpansTableView;
  private selectedSpanId: string;
  private logItemViews: SpanLogItemView[] = [];
  private fuse: Fuse<
    SpanLogItemView,
    Fuse.FuseOptions<SpanLogItemView>
  > = new Fuse([], { keys: ['fields.key', 'fields.value'] });

  private elements = {
    container: document.createElement('div'),
    toolbar: document.createElement('div'),
    toolbarBtn: {
      expandAll: document.createElement('div'),
      collapseAll: document.createElement('div'),
    },
    searchInput: document.createElement('input'),
    contentContainer: document.createElement('div'),
  };

  private binded = {
    onSearchInput: debounce(this.onSearchInput.bind(this), 100),
    onTimelineSpanSelected: this.onTimelineSpanSelected.bind(this),
    onSpansTableSpanSelected: this.onSpansTableSpanSelected.bind(this),
    onExpandAllClick: this.onExpandAllClick.bind(this),
    onCollapseAllClick: this.onCollapseAllClick.bind(this),
    onMouseMove: this.onMouseMove.bind(this),
    onMouseLeave: this.onMouseLeave.bind(this),
    onScroll: this.onScroll.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
  };

  constructor() {
    const { container, toolbar, contentContainer } = this.elements;
    container.classList.add('span-logs');

    this.prepareToolbar();
    container.appendChild(toolbar);

    contentContainer.classList.add('content-container');
    container.appendChild(contentContainer);
  }

  private prepareToolbar() {
    const toolbarEl = this.elements.toolbar;
    const btn = this.elements.toolbarBtn;
    const searchInput = this.elements.searchInput;

    toolbarEl.classList.add('widget-toolbar');

    // Panes
    const leftPane = document.createElement('div');
    leftPane.classList.add('widget-toolbar-pane');
    toolbarEl.appendChild(leftPane);

    const rightPane = document.createElement('div');
    rightPane.classList.add('widget-toolbar-pane', 'right');
    toolbarEl.appendChild(rightPane);

    // Search icon & input
    // Search icon & input
    const inputContainer = document.createElement('div');
    inputContainer.classList.add('input-with-svg-icon-container');
    leftPane.appendChild(inputContainer);
    searchInput.type = 'search';
    searchInput.placeholder = 'Search...';
    searchInput.classList.add('small', 'borderless');
    inputContainer.appendChild(searchInput);
    inputContainer.appendChild(createElementFromHTML(SvgMagnify));

    // Right buttons
    btn.expandAll.classList.add('widget-toolbar-button');
    btn.expandAll.innerHTML = SvgExpandAll;
    rightPane.appendChild(btn.expandAll);

    btn.collapseAll.classList.add('widget-toolbar-button');
    btn.collapseAll.innerHTML = SvgCollapseAll;
    rightPane.appendChild(btn.collapseAll);
  }

  init(options: { timeline: TimelineView; spansTable: SpansTableView }) {
    this.timeline = options.timeline;
    this.spansTable = options.spansTable;
    this.initTooltips();

    // Bind events
    this.elements.searchInput.addEventListener(
      'input',
      this.binded.onSearchInput,
      false
    );
    this.timeline.on(
      TimelineViewEvent.SPAN_SELECTED,
      this.binded.onTimelineSpanSelected
    );
    this.spansTable.on(
      SpansTableViewEvent.SPAN_SELECTED,
      this.binded.onSpansTableSpanSelected
    );
    this.elements.toolbarBtn.expandAll.addEventListener(
      'click',
      this.binded.onExpandAllClick,
      false
    );
    this.elements.toolbarBtn.collapseAll.addEventListener(
      'click',
      this.binded.onCollapseAllClick,
      false
    );
    this.elements.contentContainer.addEventListener(
      'scroll',
      this.binded.onScroll,
      false
    );
    this.elements.contentContainer.addEventListener(
      'mousemove',
      this.binded.onMouseMove,
      false
    );
    this.elements.contentContainer.addEventListener(
      'mouseleave',
      this.binded.onMouseLeave,
      false
    );
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);

    // Initial render
    this.render();
  }

  private initTooltips() {
    const tooltipManager = TooltipManager.getSingleton();
    const btn = this.elements.toolbarBtn;
    tooltipManager.addToSingleton([
      [
        btn.expandAll,
        {
          content: 'Expand All',
          multiple: true,
        },
      ],
      [
        btn.collapseAll,
        {
          content: 'Collapse All',
          multiple: true,
        },
      ],
    ]);
  }

  private render() {
    if (!this.selectedSpanId) {
      this.elements.contentContainer.innerHTML = `<div class="content-message">
        ${SvgCursorDefaultClick}
        <span>No Span Selected</span>
      </div>`;
      return;
    }

    // If searching
    const searchQuery = this.elements.searchInput.value.trim();
    if (searchQuery) {
      const results = this.fuse.search(searchQuery);
      if (results.length == 0) {
        this.elements.contentContainer.innerHTML = `<div class="content-message">
          ${SvgEmoticonSad}
          <span>No Result</span>
        </div>`;
        return;
      }

      this.renderLogItems(results as any);
      return;
    }

    // Not searching, display all
    if (this.logItemViews.length == 0) {
      this.elements.contentContainer.innerHTML = `<div class="content-message">
        ${SvgEmoticonSad}
        <span>No Logs</span>
      </div>`;
      return;
    }

    this.renderLogItems(this.logItemViews);
  }

  private renderLogItems(logItemViews: SpanLogItemView[]) {
    this.logItemViews.forEach((v) => v.unmount());
    this.elements.contentContainer.innerHTML = ``;
    logItemViews.forEach((v) => v.mount(this.elements.contentContainer));
  }

  private onSearchInput(e: InputEvent) {
    this.render();
  }

  private onTimelineSpanSelected(spanId: string) {
    this.updateSpan(spanId);
    this.logItemViews.forEach((v) => v.unhighlight());
  }

  private onSpansTableSpanSelected(spanId: string) {
    this.updateSpan(spanId);
    this.logItemViews.forEach((v) => v.unhighlight());
  }

  private updateSpan(spanId: string) {
    if (this.selectedSpanId == spanId) return;

    if (!spanId) {
      this.selectedSpanId = null;
      this.logItemViews.forEach((v) => {
        v.unmount();
        v.dispose();
      });
      this.logItemViews = [];
      this.fuse = new Fuse([], { keys: ['fields.key', 'fields.value'] });
      this.render();
      return;
    }

    const mainSpanGroup = this.stage.getMainSpanGroup();
    const span = mainSpanGroup.get(spanId); // TODO: If span does not exists?
    this.selectedSpanId = spanId;
    this.logItemViews = span.logs.map((log) => {
      const logItemView = new SpanLogItemView();
      logItemView.init({ log });
      return logItemView;
    });
    this.fuse = new Fuse(this.logItemViews, {
      keys: ['fields.key', 'fields.value'],
    });
    this.render();
  }

  private onExpandAllClick() {
    this.logItemViews.forEach((v) => v.expand());
  }

  private onCollapseAllClick() {
    this.logItemViews.forEach((v) => v.collapse());
  }

  private onScroll(e: MouseEvent) {
    this.timeline.hideLogVerticalLine();
  }

  private onMouseMove(e: MouseEvent) {
    const logItemEl = (e.target as HTMLElement).closest('[data-log-timestamp]');
    if (!logItemEl) return this.timeline.hideLogVerticalLine();
    const timestampStr = logItemEl.getAttribute('data-log-timestamp');
    const timestamp = Number(timestampStr);
    if (isNaN(timestamp)) return this.timeline.hideLogVerticalLine();
    this.timeline.showLogVerticalLine(timestamp);
  }

  private onMouseLeave(e: MouseEvent) {
    this.timeline.hideLogVerticalLine();
  }

  private onStageTraceRemoved() {
    if (!this.selectedSpanId) return;
    const doesStillExist = !!this.stage
      .getMainSpanGroup()
      .get(this.selectedSpanId);
    if (doesStillExist) return;
    this.updateSpan(null);
  }

  mount(parentEl: HTMLElement) {
    parentEl.appendChild(this.elements.container);
  }

  unmount() {
    const parent = this.elements.container.parentElement;
    parent?.removeChild(this.elements.container);
  }

  resize(width: number, height: number) {
    // NOOP
  }

  dispose() {
    this.elements.searchInput.removeEventListener(
      'input',
      this.binded.onSearchInput,
      false
    );
    this.timeline.removeListener(
      TimelineViewEvent.SPAN_SELECTED,
      this.binded.onTimelineSpanSelected
    );
    this.spansTable.removeListener(
      SpansTableViewEvent.SPAN_SELECTED,
      this.binded.onSpansTableSpanSelected
    );
    this.elements.toolbarBtn.expandAll.removeEventListener(
      'click',
      this.binded.onExpandAllClick,
      false
    );
    this.elements.toolbarBtn.collapseAll.removeEventListener(
      'click',
      this.binded.onCollapseAllClick,
      false
    );
    this.elements.contentContainer.removeEventListener(
      'mousemove',
      this.binded.onMouseMove,
      false
    );
    this.elements.contentContainer.removeEventListener(
      'mouseleave',
      this.binded.onMouseLeave,
      false
    );
    this.elements.contentContainer.removeEventListener(
      'scroll',
      this.binded.onScroll,
      false
    );
    this.stage.removeListener(
      StageEvent.TRACE_REMOVED,
      this.binded.onStageTraceRemoved
    );
  }
}
