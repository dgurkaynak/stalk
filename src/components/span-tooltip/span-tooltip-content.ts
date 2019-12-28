import isNumber from 'lodash/isNumber';
import SpanView from '../timeline/span-view';
import vc from '../timeline/view-constants';
import prettyMilliseconds from 'pretty-ms';
import { Span } from '../../model/interfaces';
import Axis from '../timeline/axis';
import Stage from '../../model/stage';

import './span-tooltip.css';
import CommentSvgText from '!!raw-loader!@mdi/svg/svg/comment-outline.svg';
import TagSvgText from '!!raw-loader!@mdi/svg/svg/tag-outline.svg';

export interface SpanTooltipContentOptions {
  axis: Axis;
  spanView?: SpanView;
  showLogs?: boolean;
}

export class SpanTooltipContent {
  private elements = {
    container: document.createElement('div'),
    header: document.createElement('div'),
    headerTime: document.createElement('span'),
    headerOperationName: document.createElement('span'),
    headerRight: document.createElement('div'),
    tags: document.createElement('div'),
    logs: document.createElement('div')
  };
  private stage = Stage.getSingleton();

  constructor(private options: SpanTooltipContentOptions) {
    const els = this.elements;

    els.header.classList.add('span-tooltip-header', 'span-tooltip-section');
    els.container.appendChild(els.header);

    const headerLeft = document.createElement('div');
    headerLeft.classList.add('left');
    els.header.appendChild(headerLeft);
    els.headerRight.classList.add('right');
    els.header.appendChild(els.headerRight);

    els.headerTime.classList.add('span-tooltip-time');
    headerLeft.appendChild(els.headerTime);
    els.headerOperationName.classList.add('span-tooltip-operation-name');
    headerLeft.appendChild(els.headerOperationName);

    els.tags.classList.add('span-tooltip-tags', 'span-tooltip-section');
    els.tags.style.display = 'none';
    els.container.appendChild(els.tags);

    els.logs.classList.add('span-tooltip-logs', 'span-tooltip-section');
    els.logs.style.display = 'none';
    els.container.appendChild(els.logs);
  }

  get element() {
    return this.elements.container;
  }

  updateSpan(spanView: SpanView) {
    this.options.spanView = spanView;
    const span = spanView.span;
    const els = this.elements;

    const duration = span.finishTime - span.startTime;
    const selfTime = this.stage.getSpanSelfTime(span.id);
    let durationText = prettyMilliseconds(
      (span.finishTime - span.startTime) / 1000,
      { formatSubMilliseconds: true }
    );

    // TODO: This is not working correctly (I guess)
    // Analyze it after fixing self-time
    if (isNumber(selfTime) && selfTime != duration) {
      const selfTimePretty = prettyMilliseconds(selfTime / 1000, {
        formatSubMilliseconds: true
      });
      durationText = `${durationText} (self ${selfTimePretty})`;
    }

    els.headerTime.textContent = durationText;
    els.headerOperationName.textContent = span.operationName;

    // Handle tags & logs count
    els.headerRight.innerHTML =
      `<span class="span-tooltip-tag-count">${
        Object.keys(span.tags).length
      }</span>` +
      `<span class="span-tooltip-tag-icon">${TagSvgText}</span>` +
      `<span class="span-tooltip-log-count">${span.logs.length}</span>` +
      `<span class="span-tooltip-log-icon">${CommentSvgText}</span>`;

    // TODO: Handle tags
  }

  updateMousePos(mouseX: number, mouseY: number) {
    if (!this.options.spanView) return;
    const previousLogsCacheId = ''; // this.viewPropertiesCache.nearbyLogsCacheId;
    const nearbyLogViews = this.options.spanView.getNearbyLogViews(mouseX);
    const nearbyLogsCacheId = nearbyLogViews.map(l => l.id).join('');

    // If logs are changed
    if (nearbyLogsCacheId != previousLogsCacheId) {
      // TODO
    }
  }
}
