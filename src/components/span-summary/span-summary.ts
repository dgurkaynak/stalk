import find from 'lodash/find';
import { Stage } from '../../model/stage';
import { Timeline, TimelineEvent } from '../timeline/timeline';
import {
  SpansTableView,
  SpansTableViewEvent
} from '../spans-table/spans-table';
import { serviceNameOf } from '../../model/span-grouping/service-name';
import { formatMicroseconds } from '../../utils/format-microseconds';

import SvgAlertCircle from '!!raw-loader!@mdi/svg/svg/alert-circle-outline.svg';
import SvgCursorDefaultClick from '!!raw-loader!@mdi/svg/svg/cursor-default-click-outline.svg';
import './span-summary.css';

export class SpanSummaryView {
  private stage = Stage.getSingleton();
  private timeline: Timeline;
  private spansTable: SpansTableView;
  private elements = {
    container: document.createElement('div')
  };
  private selectedSpanId: string;

  private binded = {
    onTimelineSpanSelected: this.onTimelineSpanSelected.bind(this),
    onSpansTableSpanSelected: this.onSpansTableSpanSelected.bind(this)
  };

  constructor() {
    const { container } = this.elements;
    container.classList.add('span-summary');
  }

  init(options: { timeline: Timeline; spansTable: SpansTableView }) {
    this.timeline = options.timeline;
    this.spansTable = options.spansTable;

    // Bind events
    this.timeline.on(
      TimelineEvent.SPAN_SELECTED,
      this.binded.onTimelineSpanSelected
    );
    this.spansTable.on(
      SpansTableViewEvent.SPAN_SELECTED,
      this.binded.onSpansTableSpanSelected
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

    // TODO: Show outgoing/incoming references
    // const node = mainSpanGroup.nodeOf(span);
    // const outgoingReferences = span.references.map(ref => {
    //   const refSpan = mainSpanGroup.get(ref.spanId);
    //   return { type: ref.type, spanId: ref.spanId, span: refSpan };
    // });
    // const incomingReferences = node.children.map(childNode => {
    //   const refSpan = mainSpanGroup.get(childNode.spanId);
    //   const ref = find(refSpan.references, r => r.spanId == span.id);
    //   return {
    //     type: ref && ref.type,
    //     spanId: childNode.spanId,
    //     span: refSpan
    //   };
    // });

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
    </div>`;
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
    this.timeline.removeListener(
      TimelineEvent.SPAN_SELECTED,
      this.binded.onTimelineSpanSelected
    );
    this.spansTable.removeListener(
      SpansTableViewEvent.SPAN_SELECTED,
      this.binded.onSpansTableSpanSelected
    );
  }
}
