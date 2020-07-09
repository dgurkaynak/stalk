import find from 'lodash/find';
import { Stage, StageEvent } from '../../model/stage';
import { TimelineView, TimelineViewEvent } from '../timeline/timeline-view';
import {
  SpansTableView,
  SpansTableViewEvent,
} from '../spans-table/spans-table';
import { serviceNameOf } from '../../model/span-grouping/service-name';
import { formatMicroseconds } from '../../utils/format-microseconds';
import {
  ContextMenuManager,
  ContextMenuEvent,
} from '../ui/context-menu/context-menu-manager';

import SvgAlert from '!!raw-loader!@mdi/svg/svg/alert.svg';
import SvgAlertCircle from '!!raw-loader!@mdi/svg/svg/alert-circle-outline.svg';
import SvgCursorDefaultClick from '!!raw-loader!@mdi/svg/svg/cursor-default-click-outline.svg';
import './span-summary.css';

export class SpanSummaryView {
  private stage = Stage.getSingleton();
  private timeline: TimelineView;
  private spansTable: SpansTableView;
  private contextMenuManager = ContextMenuManager.getSingleton();
  private elements = {
    container: document.createElement('div'),
  };
  private selectedSpanId: string;

  private binded = {
    onTimelineSpanSelected: this.onTimelineSpanSelected.bind(this),
    onSpansTableSpanSelected: this.onSpansTableSpanSelected.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    onContextMenu: this.onContextMenu.bind(this),
  };

  constructor() {
    const { container } = this.elements;
    container.classList.add('span-summary');
  }

  init(options: {
    timeline: TimelineView;
    spansTable: SpansTableView;
  }) {
    this.timeline = options.timeline;
    this.spansTable = options.spansTable;

    // Bind events
    this.timeline.on(
      TimelineViewEvent.SPAN_SELECTED,
      this.binded.onTimelineSpanSelected
    );
    this.spansTable.on(
      SpansTableViewEvent.SPAN_SELECTED,
      this.binded.onSpansTableSpanSelected
    );
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    this.elements.container.addEventListener(
      'contextmenu',
      this.binded.onContextMenu,
      false
    );

    // Initial render
    this.render(
      this.timeline.getSelectedSpanId() || this.spansTable.getSelectedSpanId()
    );
  }

  private onTimelineSpanSelected(spanId: string) {
    this.render(spanId);
  }

  private onSpansTableSpanSelected(spanId: string) {
    this.render(spanId);
  }

  private render(spanId: string) {
    if (!spanId) {
      this.selectedSpanId = null;
      this.elements.container.innerHTML = `<div class="no-span-selected">
        ${SvgCursorDefaultClick}
        <span>No Span Selected</span>
      </div>`;
      return;
    }

    if (spanId == this.selectedSpanId) return;
    this.selectedSpanId = spanId;

    const mainSpanGroup = this.stage.getMainSpanGroup();
    const span = mainSpanGroup.get(spanId);

    if (!span) {
      this.elements.container.innerHTML = `<div class="no-span-selected">
        ${SvgAlertCircle}
        <span>Span not found: "${spanId}"</span>
      </div>`;
      return;
    }

    // References
    let referencesBody = ``;
    if (span.references.length == 0) {
      referencesBody = `<span class="no-references">
        This span has no references, it's a root span.
      </span>`;
    } else {
      referencesBody = span.references
        .map((ref) => {
          const refSpan = mainSpanGroup.get(ref.spanId);
          if (!refSpan) {
            return `<div class="key-value-row">
            <div class="key">${ref.type}:</div>
            <div class="value bold alert" title="Span not found in the stage">${ref.spanId} ${SvgAlert}</div>
          </div>`;
          }
          return `<div class="key-value-row" data-ref-span-id="${ref.spanId}">
          <div class="key">${ref.type}:</div>
          <div class="value bold">${refSpan.operationName}</div>
        </div>`;
        })
        .join('');
    }

    this.elements.container.innerHTML = `<div class="span-summary-content">
      <div class="operation-name">${span.operationName}</div>
      <div class="key-value-row">
        <div class="key">Service:</div>
        <div class="value bold">${serviceNameOf(span)}</div>
      </div>
      <div class="key-value-row">
        <div class="key">Total Time:</div>
        <div class="value bold">${formatMicroseconds(
          span.finishTime - span.startTime
        )}</div>
      </div>
      <div class="key-value-row">
        <div class="key">Self Time:</div>
        <div class="value bold">${formatMicroseconds(
          this.stage.getSpanSelfTime(span.id)
        )}</div>
      </div>
      <div class="key-value-row" title="Relative to stage beginning">
        <div class="key">Start Time:</div>
        <div class="value">${formatMicroseconds(
          span.startTime - this.stage.startTimestamp
        )}</div>
      </div>
      <div class="key-value-row" title="Relative to stage beginning">
        <div class="key">Finish Time:</div>
        <div class="value">${formatMicroseconds(
          span.finishTime - this.stage.startTimestamp
        )}</div>
      </div>
      <div class="key-value-row">
        <div class="key">Span ID:</div>
        <div class="value">${span.id}</div>
      </div>
      <div class="key-value-row">
        <div class="key">Trace ID:</div>
        <div class="value">${span.traceId}</div>
      </div>

      <div class="references-title">References</div>
      ${referencesBody}
    </div>`;
  }

  private onStageTraceRemoved() {
    if (!this.selectedSpanId) return;
    const doesStillExist = !!this.stage
      .getMainSpanGroup()
      .get(this.selectedSpanId);
    if (doesStillExist) return;
    this.render(null);
  }

  private onContextMenu(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest('[data-ref-span-id]');
    if (!el) return;
    e.preventDefault();
    const refSpanId = el.getAttribute('data-ref-span-id');

    this.contextMenuManager.show({
      x: e.clientX,
      y: e.clientY,
      menuItems: [
        {
          selectItem: {
            type: 'item',
            text: 'Show Span in Timeline View',
            id: 'showInTimelineView',
          },
          emitEvent: {
            event: ContextMenuEvent.SHOW_SPAN_IN_TIMELINE_VIEW,
            data: refSpanId,
          },
        },
        {
          selectItem: {
            type: 'item',
            text: 'Show Span in Table View',
            id: 'showInTableView',
          },
          emitEvent: {
            event: ContextMenuEvent.SHOW_SPAN_IN_TABLE_VIEW,
            data: refSpanId,
          },
        },
      ],
    });
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
    this.elements.container.removeEventListener(
      'contextmenu',
      this.binded.onContextMenu,
      false
    );
  }
}
