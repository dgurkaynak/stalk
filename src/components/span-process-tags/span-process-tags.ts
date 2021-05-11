import Fuse from 'fuse.js';
import { Stage, StageEvent } from '../../model/stage';
import debounce from 'lodash/debounce';
import { TimelineView, TimelineViewEvent } from '../timeline/timeline-view';
import {
  SpansTableView,
  SpansTableViewEvent,
} from '../spans-table/spans-table';
import { createElementFromHTML } from '../../utils/create-element';

import SvgMagnify from '!!raw-loader!@mdi/svg/svg/magnify.svg';
import SvgCursorDefaultClick from '!!raw-loader!@mdi/svg/svg/cursor-default-click-outline.svg';
import SvgEmoticonSad from '!!raw-loader!@mdi/svg/svg/emoticon-sad-outline.svg';
import '../ui/widget-toolbar/widget-toolbar.css';
import './span-process-tags.css';

interface SpanProcessTagItem {
  key: string;
  value: string;
}

export class SpanProcessTagsView {
  private stage = Stage.getSingleton();
  private timeline: TimelineView;
  private spansTable: SpansTableView;
  private selectedSpanId: string;
  private processTagItems: SpanProcessTagItem[] = [];
  private fuse: Fuse<
    SpanProcessTagItem,
    Fuse.FuseOptions<SpanProcessTagItem>
  > = new Fuse([], { keys: ['key', 'value'] });

  private elements = {
    container: document.createElement('div'),
    toolbar: document.createElement('div'),
    searchInput: document.createElement('input'),
    contentContainer: document.createElement('div'),
  };

  private binded = {
    onSearchInput: debounce(this.onSearchInput.bind(this), 100),
    onTimelineSpanSelected: this.onTimelineSpanSelected.bind(this),
    onSpansTableSpanSelected: this.onSpansTableSpanSelected.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
  };

  constructor() {
    const { container, toolbar, contentContainer } = this.elements;
    container.classList.add('span-process-tags');

    this.prepareToolbar();
    container.appendChild(toolbar);

    contentContainer.classList.add('content-container');
    container.appendChild(contentContainer);
  }

  private prepareToolbar() {
    const toolbarEl = this.elements.toolbar;
    const searchInput = this.elements.searchInput;

    toolbarEl.classList.add('widget-toolbar');

    // Search icon & input
    const inputContainer = document.createElement('div');
    inputContainer.classList.add('input-with-svg-icon-container');
    toolbarEl.appendChild(inputContainer);
    searchInput.type = 'search';
    searchInput.placeholder = 'Search...';
    searchInput.classList.add('small', 'borderless');
    inputContainer.appendChild(searchInput);
    inputContainer.appendChild(createElementFromHTML(SvgMagnify));
  }

  init(options: { timeline: TimelineView; spansTable: SpansTableView }) {
    this.timeline = options.timeline;
    this.spansTable = options.spansTable;

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
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);

    // Initial render
    this.render();
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

      this.renderTagItems(results as any);
      return;
    }

    // Not searching, display all
    if (this.processTagItems.length == 0) {
      this.elements.contentContainer.innerHTML = `<div class="content-message">
        ${SvgEmoticonSad}
        <span>No Tags</span>
      </div>`;
      return;
    }

    this.renderTagItems(this.processTagItems);
  }

  private renderTagItems(tagItems: SpanProcessTagItem[]) {
    this.elements.contentContainer.innerHTML = tagItems
      .map(({ key, value }) => {
        const errorClass = key.toLowerCase() == 'error' ? 'error' : '';
        return `<div class="key-value-row ${errorClass}">
        <div class="key">${key}:</div>
        <div class="value bold">${value}</div>
      </div>`;
      })
      .join('');
  }

  private onSearchInput(e: InputEvent) {
    this.render();
  }

  private onTimelineSpanSelected(spanId: string) {
    this.updateSpan(spanId);
  }

  private onSpansTableSpanSelected(spanId: string) {
    this.updateSpan(spanId);
  }

  private updateSpan(spanId: string) {
    if (this.selectedSpanId == spanId) return;

    if (!spanId) {
      this.selectedSpanId = null;
      this.processTagItems = [];
      this.fuse = new Fuse([], { keys: ['key', 'value'] });
      this.render();
      return;
    }

    const mainSpanGroup = this.stage.getMainSpanGroup();
    const span = mainSpanGroup.get(spanId); // TODO: If span does not exists?
    this.selectedSpanId = spanId;
    const processTags = span.process ? span.process.tags || {} : {};
    this.processTagItems = Object.keys(processTags)
      .sort((a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      })
      .map((key) => ({ key, value: processTags[key] }));
    this.fuse = new Fuse(this.processTagItems, { keys: ['key', 'value'] });
    this.render();
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
    this.stage.removeListener(
      StageEvent.TRACE_REMOVED,
      this.binded.onStageTraceRemoved
    );
  }
}
