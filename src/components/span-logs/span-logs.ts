import Fuse from 'fuse.js';
import { Stage } from '../../model/stage';
import debounce from 'lodash/debounce';
import { Timeline, TimelineEvent } from '../timeline/timeline';
import { SpanLogItemView } from './span-log-item';

import SvgMagnify from '!!raw-loader!@mdi/svg/svg/magnify.svg';
import SvgCursorDefaultClick from '!!raw-loader!@mdi/svg/svg/cursor-default-click-outline.svg';
import SvgEmoticonSad from '!!raw-loader!@mdi/svg/svg/emoticon-sad-outline.svg';
import '../ui/widget-toolbar/widget-toolbar.css';
import './span-logs.css';

export class SpanLogsView {
  private stage = Stage.getSingleton();
  private timeline: Timeline;
  private selectedSpanId: string;
  private logItemViews: SpanLogItemView[] = [];
  private fuse: Fuse<
    SpanLogItemView,
    Fuse.FuseOptions<SpanLogItemView>
  > = new Fuse([], { keys: ['fields.key', 'fields.value'] });

  private elements = {
    container: document.createElement('div'),
    toolbar: document.createElement('div'),
    searchInput: document.createElement('input'),
    contentContainer: document.createElement('div')
  };

  private binded = {
    onSearchInput: debounce(this.onSearchInput.bind(this), 100),
    onTimelineSpanSelected: this.onTimelineSpanSelected.bind(this)
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
    const searchInput = this.elements.searchInput;

    toolbarEl.classList.add('widget-toolbar', 'widget-toolbar');

    // Panes
    const leftPane = document.createElement('div');
    leftPane.classList.add('widget-toolbar-pane');
    toolbarEl.appendChild(leftPane);

    const rightPane = document.createElement('div');
    rightPane.classList.add('widget-toolbar-pane', 'right');
    toolbarEl.appendChild(rightPane);

    // Search icon & input
    const searchContainer = document.createElement('div');
    searchContainer.classList.add('search-container');
    leftPane.appendChild(searchContainer);
    searchContainer.innerHTML = SvgMagnify;
    searchInput.type = 'search';
    searchInput.placeholder = 'Search...';
    searchContainer.appendChild(searchInput);
  }

  init(options: { timeline: Timeline }) {
    this.timeline = options.timeline;

    // Bind events
    this.elements.searchInput.addEventListener(
      'input',
      this.binded.onSearchInput,
      false
    );
    this.timeline.on(
      TimelineEvent.SPAN_SELECTED,
      this.binded.onTimelineSpanSelected
    );

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
    this.logItemViews.forEach(v => v.unmount());
    this.elements.contentContainer.innerHTML = ``;
    logItemViews.forEach(v => v.mount(this.elements.contentContainer));
  }

  private onSearchInput(e: InputEvent) {
    this.render();
  }

  private onTimelineSpanSelected() {
    const spanId = this.timeline.getSelectedSpanId();

    if (this.selectedSpanId == spanId) return;

    if (!spanId) {
      this.selectedSpanId = null;
      this.logItemViews.forEach(v => {
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
    this.logItemViews = span.logs.map(log => {
      const logItemView = new SpanLogItemView();
      logItemView.init({ log });
      return logItemView;
    });
    this.fuse = new Fuse(this.logItemViews, {
      keys: ['fields.key', 'fields.value']
    });
    this.render();
  }

  mount(parentEl: HTMLElement) {
    parentEl.appendChild(this.elements.container);
  }

  unmount() {
    const parent = this.elements.container.parentElement;
    parent && parent.removeChild(this.elements.container);
  }

  resize(width: number, height: number) {
    // TODO
  }

  dispose() {
    this.elements.searchInput.removeEventListener(
      'input',
      this.binded.onSearchInput,
      false
    );
    this.timeline.removeListener(
      TimelineEvent.SPAN_SELECTED,
      this.binded.onTimelineSpanSelected
    );
  }
}
