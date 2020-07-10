import { formatMicroseconds } from '../../utils/format-microseconds';
import { Trace } from '../../model/trace';

import './trace-tooltip.css';
import CounterSvgText from '!!raw-loader!@mdi/svg/svg/rectangle.svg';
import AlertSvgText from '!!raw-loader!@mdi/svg/svg/alert.svg';

export class TraceTooltipContent {
  private elements = {
    container: document.createElement('div'),
    time: document.createElement('span'),
    name: document.createElement('span'),
    right: document.createElement('div'),
  };
  private trace: Trace;

  constructor() {
    const els = this.elements;

    els.container.classList.add('trace-tooltip');

    const left = document.createElement('div');
    left.classList.add('left');
    els.container.appendChild(left);
    els.right.classList.add('right');
    els.container.appendChild(els.right);

    els.time.classList.add('trace-tooltip-time');
    left.appendChild(els.time);
    els.name.classList.add('trace-tooltip-name');
    left.appendChild(els.name);
  }

  get element() {
    return this.elements.container;
  }

  updateTrace(trace: Trace) {
    this.trace = trace;
    const els = this.elements;

    const timeText = formatMicroseconds(trace.duration);
    els.time.textContent = timeText;

    els.name.textContent = trace.name;

    if (trace.errorCount > 0) {
      els.right.innerHTML =
        `<span class="trace-tooltip-span-count">${trace.spanCount} span(s)</span>` +
        `<span class="trace-tooltip-error-count">${trace.errorCount}</span>` +
        `<span class="trace-tooltip-error-icon">${AlertSvgText}</span>`;
    } else {
      els.right.innerHTML = `<span class="trace-tooltip-span-count">${trace.spanCount} span(s)</span>`;
    }
  }
}
