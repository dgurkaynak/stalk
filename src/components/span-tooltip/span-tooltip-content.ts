import isNumber from 'lodash/isNumber';
import cloneDeep from 'lodash/cloneDeep';
import SpanView from '../timeline/span-view';
import { formatMicroseconds } from '../../utils/format-microseconds';
import Axis from '../timeline/axis';
import Stage from '../../model/stage';
import { serviceNameOf } from '../../model/span-grouping/service-name';

import './span-tooltip.css';
import CommentSvgText from '!!raw-loader!@mdi/svg/svg/comment-outline.svg';
import TagSvgText from '!!raw-loader!@mdi/svg/svg/tag-outline.svg';
import AlertSvgText from '!!raw-loader!@mdi/svg/svg/alert.svg';

export interface SpanTooltipContentOptions {
  axis: Axis;
  spanView?: SpanView;
  showServiceName?: boolean;
  showNearbyLogs?: boolean;
  spanTagsToShow?: string[];
  processTagsToShow?: string[];
  // logFieldsToShow?: string[];
}

export class SpanTooltipContent {
  private options: SpanTooltipContentOptions;
  private elements = {
    container: document.createElement('div'),
    header: document.createElement('div'),
    headerTime: document.createElement('span'),
    headerOperationName: document.createElement('span'),
    headerRight: document.createElement('div'),
    serviceNameContainer: document.createElement('div'),
    serviceName: document.createElement('span'),
    tags: document.createElement('div'),
    processTags: document.createElement('div'),
    logs: document.createElement('div')
  };
  private stage = Stage.getSingleton();
  private nearbyLogsCacheId = '';

  constructor(options: SpanTooltipContentOptions) {
    this.options = Object.assign(
      {
        showNearbyLogs: true,
        showServiceName: false,
        spanTagsToShow: [],
        processTagsToShow: [],
        // logFieldsToShow: []
      },
      options
    );
    const els = this.elements;

    els.header.classList.add('span-tooltip-header');
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

    els.serviceNameContainer.classList.add(
      'span-tooltip-tag',
      'span-service-name-container',
      'span-tooltip-border-top'
    );
    els.serviceNameContainer.style.display = 'none';
    els.container.appendChild(els.serviceNameContainer);
    const serviceNameLeft = document.createElement('span');
    serviceNameLeft.classList.add('tag-path');
    serviceNameLeft.textContent = 'Service:';
    els.serviceNameContainer.appendChild(serviceNameLeft);
    els.serviceName.classList.add('tag-value');
    els.serviceNameContainer.appendChild(els.serviceName);

    els.tags.classList.add('span-tooltip-tags', 'span-tooltip-border-top');
    els.tags.style.display = 'none';
    els.container.appendChild(els.tags);

    els.processTags.classList.add(
      'span-tooltip-process-tags',
      'span-tooltip-border-top'
    );
    els.processTags.style.display = 'none';
    els.container.appendChild(els.processTags);

    // els.logs.classList.add('span-tooltip-logs');
    els.logs.style.display = 'none';
    els.container.appendChild(els.logs);
  }

  get element() {
    return this.elements.container;
  }

  getOptions() {
    return cloneDeep(this.options);
  }

  setShowServiceName(value: boolean) {
    this.options.showServiceName = value;
    this.updateSpan(this.options.spanView);
  }

  setShowNearbyLogs(value: boolean) {
    this.options.showNearbyLogs = value;
    this.updateSpan(this.options.spanView);
  }

  setSpanTagsToShow(tags: string[]) {
    this.options.spanTagsToShow = tags;
    this.setupTags();
  }

  setProcessTagsToShow(tags: string[]) {
    this.options.processTagsToShow = tags;
    this.setupProcessTags();
  }

  updateSpan(spanView: SpanView) {
    this.options.spanView = spanView;
    const span = spanView.span;
    const els = this.elements;

    const totalTime = span.finishTime - span.startTime;
    const selfTime = this.stage.getSpanSelfTime(span.id);
    let timeText = formatMicroseconds(span.finishTime - span.startTime);

    // TODO: This is not working correctly (I guess)
    // Analyze it after fixing self-time
    if (isNumber(selfTime) && selfTime != totalTime) {
      const selfTimePretty = formatMicroseconds(selfTime);
      timeText = `${timeText} (self ${selfTimePretty})`;
    }

    els.headerTime.textContent = timeText;
    els.headerOperationName.innerHTML =
      (span.tags.hasOwnProperty('error') ? `<span class="span-tooltip-error-icon">${AlertSvgText}</span>` : '') +
      span.operationName;

    // Handle tags & logs count
    els.headerRight.innerHTML =
      `<span class="span-tooltip-tag-count">${
        Object.keys(span.tags).length
      }</span>` +
      `<span class="span-tooltip-tag-icon">${TagSvgText}</span>` +
      `<span class="span-tooltip-log-count">${span.logs.length}</span>` +
      `<span class="span-tooltip-log-icon">${CommentSvgText}</span>`;

    // Handle service name
    const serviceName = serviceNameOf(span);
    if (this.options.showServiceName && serviceName) {
      els.serviceName.textContent = serviceName;
      els.serviceNameContainer.style.display = '';
    } else {
      els.serviceName.textContent = '';
      els.serviceNameContainer.style.display = 'none';
    }

    // Handle tags
    this.setupTags();
    this.setupProcessTags();
  }

  private setupTags() {
    if (!this.options.spanView) return false;
    const span = this.options.spanView.span;
    const els = this.elements;
    els.tags.innerHTML = '<div class="section-header">Tags</div>';

    const tagKeysSorted = this.options.spanTagsToShow.sort();
    // const tagKeysSorted = Object.keys(span.tags).sort();
    let displayedTagCount = 0;
    tagKeysSorted.forEach(tagKey => {
      const value = span.tags[tagKey];
      if (!value) return;
      const tagEl = document.createElement('div');
      tagEl.classList.add('span-tooltip-tag', 'margin-left');
      tagEl.innerHTML =
        `<span class="tag-path">${tagKey}:</span>` +
        `<span class="tag-value">${value}</span>`;
      els.tags.appendChild(tagEl);
      displayedTagCount++;
    });
    els.tags.style.display = displayedTagCount == 0 ? 'none' : 'block';
  }

  private setupProcessTags() {
    if (!this.options.spanView) return false;
    const span = this.options.spanView.span;
    const els = this.elements;
    els.processTags.innerHTML =
      '<div class="section-header">Process Tags</div>';

    const tagKeysSorted = this.options.processTagsToShow.sort();
    // const tagKeysSorted = Object.keys(
    //   span.process ? span.process.tags || {} : {}
    // ).sort();
    let displayedTagCount = 0;
    tagKeysSorted.forEach(tagKey => {
      const value = span.process.tags[tagKey];
      if (!value) return;
      const tagEl = document.createElement('div');
      tagEl.classList.add('span-tooltip-tag', 'margin-left');
      tagEl.innerHTML =
        `<span class="tag-path">${tagKey}</span>` +
        `<span class="tag-value">${value}</span>`;
      els.processTags.appendChild(tagEl);
      displayedTagCount++;
    });
    els.processTags.style.display = displayedTagCount == 0 ? 'none' : 'block';
  }

  updateMousePos(mouseX: number, mouseY: number) {
    const els = this.elements;
    if (!this.options.showNearbyLogs || !this.options.spanView) {
      els.logs.style.display = 'none';
      return;
    }

    const previousLogsCacheId = this.nearbyLogsCacheId;
    const nearbyLogs = this.options.spanView.getNearbyLogViews(mouseX);
    this.nearbyLogsCacheId = nearbyLogs.map(l => l.logView.id).join('');

    // If logs are not changed, early terminate
    if (this.nearbyLogsCacheId == previousLogsCacheId) {
      return;
    }

    els.logs.innerHTML = '';

    nearbyLogs.forEach(log => {
      const time = formatMicroseconds(log.logView.log.timestamp - this.options.axis.getInputRange()[0]);

      const logContainer = document.createElement('div');
      logContainer.classList.add('span-tooltip-log', 'span-tooltip-border-top');
      let html = `<div class="section-header">Log @ ${time}</div>`;

      // const logFields = this.options.logFieldsToShow;
      const logFields = Object.keys(log.logView.log.fields);
      logFields.forEach(key => {
        const value = log.logView.log.fields[key];
        if (!value) return;
        html +=
          `<span class="log-field-key">${key}:</span>` +
          `<span class="log-field-value">${value}</span>`;
      });

      logContainer.innerHTML = html;
      els.logs.appendChild(logContainer);
    });

    els.logs.style.display = nearbyLogs.length == 0 ? 'none' : 'block';
  }
}
