import defaults from 'lodash/defaults';
import { SpanLog } from '../../model/interfaces';
import { formatMicroseconds } from '../../utils/format-microseconds';
import { Stage } from '../../model/stage';

import './span-log-item.css';
import AlertSvgText from '!!raw-loader!@mdi/svg/svg/alert.svg';

export interface SpanLogItemViewOptions {
  log: SpanLog;
  isExpanded: boolean;
  title: string;
}

export class SpanLogItemView {
  private stage = Stage.getSingleton();
  private elements = {
    container: document.createElement('div'),
    header: document.createElement('div'),
    body: document.createElement('div')
  };
  private options: SpanLogItemViewOptions;

  // This is for fuse.js searching
  fields: {
    key: string;
    value: string;
  }[] = [];

  private binded = {
    onHeaderClick: this.onHeaderClick.bind(this)
  };

  constructor() {
    const el = this.elements;
    el.container.classList.add('span-log-item');

    el.header.classList.add('span-log-item-header');
    el.container.appendChild(el.header);

    el.body.classList.add('span-log-item-body');
    el.container.appendChild(el.body);
  }

  init(options: Partial<SpanLogItemViewOptions>) {
    this.options = defaults(options, {
      log: null,
      isExpanded: false,
      title: null
    });

    if (!this.options.title) {
      const timeStr = formatMicroseconds(
        this.options.log.timestamp - this.stage.startTimestamp
      );
      this.options.title = `t = ${timeStr}`;
    }

    // Prepare the `fields` for fuse.js search
    this.fields = Object.keys(this.options.log.fields)
      .sort((a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      })
      .map(key => {
        const value = this.options.log.fields[key];
        return { key, value };
      });

    // Bind events
    this.elements.header.addEventListener(
      'click',
      this.binded.onHeaderClick,
      false
    );

    // Initial render
    this.render();
  }

  expand() {
    this.options.isExpanded = true;
    this.render();
  }

  collapse() {
    this.options.isExpanded = false;
    this.render();
  }

  private render() {
    this.elements.container.setAttribute(
      'data-log-timestamp',
      `${this.options.log.timestamp}`
    );

    if (this.options.isExpanded) {
      this.renderExpanded();
    } else {
      this.renderCollapsed();
    }
  }

  private renderCollapsed() {
    const el = this.elements;
    let hasError = false;

    const inlineLogFieldsHtml = Object.keys(this.options.log.fields)
      .sort((a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      })
      .map(key => {
        if (key.toLowerCase() == 'error') hasError = true;
        const value = this.options.log.fields[key];
        return `<span class="key">${key}:</span>
          <span class="value">${value}</span>`;
      })
      .join(' ');

    el.header.innerHTML = `<span class="arrow-right">►</span>
      <span class="title">${this.options.title}</span>
      ${hasError ? AlertSvgText : ''}
      <span class="curly">{</span>
      <span class="inline-fields">${inlineLogFieldsHtml}</span>
      <span class="curly">}</span>`;

    el.body.innerHTML = '';
  }

  private renderExpanded() {
    const el = this.elements;
    let hasError = false;

    const logFieldsHtml = Object.keys(this.options.log.fields)
      .sort((a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      })
      .map(key => {
        if (key.toLowerCase() == 'error') hasError = true;
        const value = this.options.log.fields[key];
        return `<div class="body-row">
          <span class="key">${key}:</span>
          <span class="value">${value}</span>
        </div>`;
      })
      .join('');

    el.header.innerHTML = `<span class="arrow-down">▼</span>
      <span class="title">${this.options.title}</span>
      ${hasError ? AlertSvgText : ''}
      <span class="curly">{</span>`;

    el.body.innerHTML = `${logFieldsHtml}
      <span class="curly">}</span>`;
  }

  private onHeaderClick() {
    this.options.isExpanded = !this.options.isExpanded;
    this.render();
  }

  mount(parentEl: HTMLElement) {
    parentEl.appendChild(this.elements.container);
  }

  unmount() {
    const parent = this.elements.container.parentElement;
    parent && parent.removeChild(this.elements.container);
  }

  dispose() {
    this.elements.header.removeEventListener(
      'click',
      this.binded.onHeaderClick,
      false
    );
  }
}
