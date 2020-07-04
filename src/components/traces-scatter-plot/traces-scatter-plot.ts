import { Trace } from '../../model/trace';
import defaults from 'lodash/defaults';
import find from 'lodash/find';
import map from '../../utils/map';
import { MPN65ColorAssigner } from '../ui/color-assigner-mpn65';
import ticks from '../../utils/ticks';
import { formatMicroseconds } from '../../utils/format-microseconds';
import isSameDay from 'date-fns/isSameDay';
import format from 'date-fns/format';
import EventEmitter from 'events';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface TracesScatterPlotStyle {
  xAxisTickInterval: number; // in px
  yAxisTickInterval: number; // in px
  axisTickLength: number;
  axisTickWidth: number;
  axisTickLabelColor: string;
  axisTickLabelSize: number;
  axisTickLabelOffset: number;
  axisMarginTop: number;
  axisMarginBottom: number;
  axisMarginLeft: number;
  axisMarginRight: number;
  axisLineColor: string;
  axisLineWidth: number;
  pointFillOpacity: number;
  pointFillOpacityHover: number;
  pointRadius: number;
  pointsMarginLeft: number;
  pointsMarginTop: number;
  pointsMarginRight: number;
  pointsMarginBottom: number;
}

export interface TracesScatterPlotComputedStyles
  extends TracesScatterPlotStyle {
  width: number;
  height: number;
}

export enum TracesScatterPlotEvent {
  POINT_HOVERED = 'tsp_point_hovered',
  POINT_UNHOVERED = 'tsp_point_unhovered',
  POINT_CLICKED = 'tsp_point_clicked'
}

export class TracesScatterPlot extends EventEmitter {
  private elements = {
    svg: document.createElementNS(SVG_NS, 'svg'),
    defs: document.createElementNS(SVG_NS, 'defs'),
    chartContainer: document.createElementNS(SVG_NS, 'g'),
    xAxisLine: document.createElementNS(SVG_NS, 'line'),
    yAxisLine: document.createElementNS(SVG_NS, 'line')
  };
  private readonly computedStyles: TracesScatterPlotComputedStyles;
  private colorAssigner = new MPN65ColorAssigner();

  private sceneStats: {
    minDuration: number;
    maxDuration: number;
    minStartTime: number;
    maxStartTime: number;
  };
  private points: {
    trace: Trace; // You can rename this as `data`, you can take its type from generic
    circle: SVGCircleElement;
  }[] = [];
  private xAxisTicks: {
    ts: number;
    tickLine: SVGLineElement;
    labelText: SVGTextElement;
  }[] = [];
  private yAxisTicks: {
    duration: number;
    tickLine: SVGLineElement;
    labelText: SVGTextElement;
  }[] = [];

  private hoveredPoint: {
    trace: Trace;
    circle: SVGCircleElement;
  };

  private binded = {
    onMouseMove: this.onMouseMove.bind(this),
    onMouseLeave: this.onMouseLeave.bind(this),
    onClick: this.onClick.bind(this)
  };

  constructor(options?: { style?: TracesScatterPlotStyle }) {
    super();

    const style = defaults(options?.style, {
      xAxisTickInterval: 250,
      yAxisTickInterval: 80,
      axisTickLength: 5,
      axisTickWidth: 1,
      axisTickLabelColor: '#333',
      axisTickLabelSize: 10,
      axisTickLabelOffset: 3,
      axisMarginTop: 20,
      axisMarginBottom: 30,
      axisMarginLeft: 50,
      axisMarginRight: 20,
      axisLineColor: '#999',
      axisLineWidth: 1,
      pointFillOpacity: 0.5,
      pointFillOpacityHover: 1.0,
      pointRadius: 5,
      pointsMarginLeft: 20,
      pointsMarginTop: 10,
      pointsMarginRight: 20,
      pointsMarginBottom: 10
    } as TracesScatterPlotStyle);
    this.computedStyles = {
      ...style,
      width: 0,
      height: 0
    };

    const { svg, defs, chartContainer, xAxisLine, yAxisLine } = this.elements;
    svg.setAttributeNS(
      'http://www.w3.org/2000/xmlns/',
      'xmlns:xlink',
      'http://www.w3.org/1999/xlink'
    );
    svg.classList.add('scatter-plot-svg');
    svg.appendChild(defs);

    chartContainer.setAttribute('x', `0`);
    chartContainer.setAttribute('y', `0`);
    svg.appendChild(chartContainer);

    xAxisLine.setAttribute('stroke', style.axisLineColor);
    xAxisLine.setAttribute('stroke-width', `${style.axisLineWidth}`);
    xAxisLine.setAttribute('shape-rendering', `crispEdges`); // https://stackoverflow.com/a/34229584
    chartContainer.appendChild(xAxisLine);

    yAxisLine.setAttribute('stroke', style.axisLineColor);
    yAxisLine.setAttribute('stroke-width', `${style.axisLineWidth}`);
    yAxisLine.setAttribute('shape-rendering', `crispEdges`); // https://stackoverflow.com/a/34229584
    chartContainer.appendChild(yAxisLine);

    // Bind events
    this.elements.svg.addEventListener(
      'mousemove',
      this.binded.onMouseMove,
      false
    );
    this.elements.svg.addEventListener(
      'mouseleave',
      this.binded.onMouseLeave,
      false
    );
    this.elements.svg.addEventListener('click', this.binded.onClick, false);
  }

  mount(parentElement: HTMLDivElement) {
    parentElement.appendChild(this.elements.svg);
  }

  unmount() {
    const { svg } = this.elements;
    svg.parentElement?.removeChild(svg);
  }

  init(options: { width: number; height: number }) {
    this.resize(options.width, options.height);
  }

  setTraces(traces: Trace[]) {
    let minDuration = Infinity;
    let maxDuration = -Infinity;
    let minStartTime = Infinity;
    let maxStartTime = -Infinity;

    traces.forEach(trace => {
      minDuration = Math.min(minDuration, trace.duration);
      maxDuration = Math.max(maxDuration, trace.duration);
      minStartTime = Math.min(minStartTime, trace.startTime);
      maxStartTime = Math.max(maxStartTime, trace.startTime);
    });

    if (traces.length == 1) {
      // TODO: Special case
    }

    this.sceneStats = {
      minDuration,
      maxDuration,
      minStartTime,
      maxStartTime
    };

    // Unmount all the previous circles
    this.points.forEach(p => p.circle.parentElement?.removeChild(p.circle));

    const s = this.computedStyles;

    // New circles
    this.points = traces.map(trace => {
      const circle = document.createElementNS(SVG_NS, 'circle');
      const x = this.getX(trace.startTime);
      const y = this.getY(trace.duration);

      circle.setAttribute('cx', `${x}`);
      circle.setAttribute('cy', `${y}`);
      circle.setAttribute('r', `${s.pointRadius}`);
      circle.setAttribute('fill', `${this.colorAssigner.colorFor(trace.name)}`);
      circle.setAttribute('opacity', `${s.pointFillOpacity}`);
      circle.setAttribute('cursor', `pointer`);
      circle.setAttribute('data-trace-id', `${trace.id}`);

      this.elements.chartContainer.appendChild(circle);

      return {
        trace,
        circle
      };
    });

    // Unmount all the previous tick lines of y-axis
    this.yAxisTicks.forEach(t => {
      t.tickLine.parentElement?.removeChild(t.tickLine);
      t.labelText.parentElement?.removeChild(t.labelText);
    });
    // And the new ones
    this.yAxisTicks = ticks(
      minDuration,
      maxDuration,
      Math.ceil(s.height / s.yAxisTickInterval)
    ).map(duration => {
      const tickLine = document.createElementNS(SVG_NS, 'line');
      const labelText = document.createElementNS(SVG_NS, 'text');

      const y = this.getY(duration);

      tickLine.setAttribute('x1', `${s.axisMarginLeft - s.axisTickLength / 2}`);
      tickLine.setAttribute('x2', `${s.axisMarginLeft + s.axisTickLength / 2}`);
      tickLine.setAttribute('y1', `${y}`);
      tickLine.setAttribute('y2', `${y}`);
      tickLine.setAttribute('stroke', s.axisLineColor);
      tickLine.setAttribute('stroke-width', `${s.axisTickWidth}`);
      tickLine.setAttribute('shape-rendering', `crispEdges`);
      this.elements.chartContainer.appendChild(tickLine);

      labelText.setAttribute('text-anchor', 'end');
      labelText.setAttribute('alignment-baseline', 'central');
      labelText.setAttribute('text-rendering', 'optimizeLegibility');
      labelText.setAttribute(
        'x',
        `${s.axisMarginLeft - s.axisTickLength / 2 - s.axisTickLabelOffset}`
      );
      labelText.setAttribute('y', `${y}`);
      labelText.setAttribute('fill', s.axisTickLabelColor);
      labelText.setAttribute('stroke', 'none');
      labelText.setAttribute('font-size', `${s.axisTickLabelSize}`);
      labelText.textContent = formatMicroseconds(duration);
      this.elements.chartContainer.appendChild(labelText);

      return {
        duration,
        tickLine,
        labelText
      };
    });

    // Unmount all the previous tick lines of x-axis
    this.xAxisTicks.forEach(t => {
      t.tickLine.parentElement?.removeChild(t.tickLine);
      t.labelText.parentElement?.removeChild(t.labelText);
    });
    // And the new ones
    const xAxisTickTimestamps = ticks(
      minStartTime,
      maxStartTime,
      Math.ceil(s.width / s.xAxisTickInterval)
    );
    let areTicksSameDay = true;
    if (xAxisTickTimestamps.length > 1) {
      const firstDate = new Date(xAxisTickTimestamps[0] / 1000);
      for (let i = 1; i < xAxisTickTimestamps.length; i++) {
        const date = new Date(xAxisTickTimestamps[i] / 1000);
        if (!isSameDay(firstDate, date)) {
          areTicksSameDay = false;
          break;
        }
      }
    }
    this.xAxisTicks = xAxisTickTimestamps.map(ts => {
      const tickLine = document.createElementNS(SVG_NS, 'line');
      const labelText = document.createElementNS(SVG_NS, 'text');

      const x = this.getX(ts);

      tickLine.setAttribute('x1', `${x}`);
      tickLine.setAttribute('x2', `${x}`);
      tickLine.setAttribute(
        'y1',
        `${s.height - s.axisMarginBottom - s.axisTickLength / 2}`
      );
      tickLine.setAttribute(
        'y2',
        `${s.height - s.axisMarginBottom + s.axisTickLength / 2}`
      );
      tickLine.setAttribute('stroke', s.axisLineColor);
      tickLine.setAttribute('stroke-width', `${s.axisTickWidth}`);
      tickLine.setAttribute('shape-rendering', `crispEdges`);
      this.elements.chartContainer.appendChild(tickLine);

      labelText.setAttribute('text-anchor', 'middle');
      labelText.setAttribute('alignment-baseline', 'before-edge');
      labelText.setAttribute('text-rendering', 'optimizeLegibility');
      labelText.setAttribute('x', `${x}`);
      labelText.setAttribute(
        'y',
        `${s.height -
          s.axisMarginBottom +
          s.axisTickLength / 2 +
          s.axisTickLabelOffset}`
      );
      labelText.setAttribute('fill', s.axisTickLabelColor);
      labelText.setAttribute('stroke', 'none');
      labelText.setAttribute('font-size', `${s.axisTickLabelSize}`);
      labelText.textContent = format(
        new Date(ts / 1000),
        areTicksSameDay ? 'HH:mm:ss' : 'MMM dd, HH:mm:ss'
      );
      this.elements.chartContainer.appendChild(labelText);

      return {
        ts,
        tickLine,
        labelText
      };
    });
  }

  resize(width: number, height: number) {
    this.computedStyles.width = width;
    this.computedStyles.height = height;

    const { svg } = this.elements;
    svg.setAttribute('width', `${width}`);
    svg.setAttribute('height', `${height}`);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    this.updateAxises();
    this.updatePoints();
    this.updateTicks();
  }

  private updateAxises() {
    const { xAxisLine, yAxisLine } = this.elements;
    const s = this.computedStyles;

    // x axis
    xAxisLine.setAttribute('x1', `${s.axisMarginLeft}`);
    xAxisLine.setAttribute('y1', `${s.height - s.axisMarginBottom}`);
    xAxisLine.setAttribute('x2', `${s.width - s.axisMarginRight}`);
    xAxisLine.setAttribute('y2', `${s.height - s.axisMarginBottom}`);

    // y axis
    yAxisLine.setAttribute('x1', `${s.axisMarginLeft}`);
    yAxisLine.setAttribute('y1', `${s.axisMarginTop}`);
    yAxisLine.setAttribute('x2', `${s.axisMarginLeft}`);
    yAxisLine.setAttribute('y2', `${s.height - s.axisMarginBottom}`);
  }

  private updatePoints() {
    if (this.points.length == 0) {
      return;
    }

    this.points.forEach(p => {
      const x = this.getX(p.trace.startTime);
      const y = this.getY(p.trace.duration);

      p.circle.setAttribute('cx', `${x}`);
      p.circle.setAttribute('cy', `${y}`);
    });
  }

  private updateTicks() {
    const s = this.computedStyles;

    this.yAxisTicks.forEach(t => {
      const y = this.getY(t.duration);

      t.tickLine.setAttribute(
        'x1',
        `${s.axisMarginLeft - s.axisTickLength / 2}`
      );
      t.tickLine.setAttribute(
        'x2',
        `${s.axisMarginLeft + s.axisTickLength / 2}`
      );
      t.tickLine.setAttribute('y1', `${y}`);
      t.tickLine.setAttribute('y2', `${y}`);
    });

    this.xAxisTicks.forEach(t => {
      const x = this.getX(t.ts);

      t.tickLine.setAttribute('x1', `${x}`);
      t.tickLine.setAttribute('x2', `${x}`);
      t.tickLine.setAttribute(
        'y1',
        `${s.height - s.axisMarginBottom - s.axisTickLength / 2}`
      );
      t.tickLine.setAttribute(
        'y2',
        `${s.height - s.axisMarginBottom + s.axisTickLength / 2}`
      );

      t.labelText.setAttribute('x', `${x}`);
      t.labelText.setAttribute(
        'y',
        `${s.height -
          s.axisMarginBottom +
          s.axisTickLength / 2 +
          s.axisTickLabelOffset}`
      );
    });
  }

  private getX(ts: number) {
    const s = this.computedStyles;
    return map(
      ts,
      this.sceneStats.minStartTime,
      this.sceneStats.maxStartTime,
      s.axisMarginLeft + s.pointsMarginLeft,
      s.width - s.axisMarginRight - s.pointsMarginRight
    );
  }

  private getY(duration: number) {
    const s = this.computedStyles;
    return map(
      duration,
      this.sceneStats.minDuration,
      this.sceneStats.maxDuration,
      s.height - s.axisMarginBottom - s.pointsMarginBottom,
      s.axisMarginTop + s.pointsMarginTop
    );
  }

  private onMouseMove(e: MouseEvent) {
    const newHoveredPoint = this.getPointFromMouseEvent(e);
    const s = this.computedStyles;

    if (
      this.hoveredPoint &&
      this.hoveredPoint.trace.id != newHoveredPoint?.trace.id
    ) {
      const unhoveredPoint = this.hoveredPoint;
      this.hoveredPoint = null;
      unhoveredPoint.circle.setAttribute('opacity', `${s.pointFillOpacity}`);
      this.emit(TracesScatterPlotEvent.POINT_UNHOVERED, unhoveredPoint.trace);
    }

    if (newHoveredPoint) {
      newHoveredPoint.circle.setAttribute(
        'opacity',
        `${s.pointFillOpacityHover}`
      );
      this.hoveredPoint = newHoveredPoint;
      this.emit(TracesScatterPlotEvent.POINT_HOVERED, newHoveredPoint);
    }
  }

  private onMouseLeave(e: MouseEvent) {
    if (!this.hoveredPoint) {
      return;
    }

    const s = this.computedStyles;
    const unhoveredPoint = this.hoveredPoint;
    this.hoveredPoint = null;
    unhoveredPoint.circle.setAttribute('opacity', `${s.pointFillOpacity}`);
    this.emit(TracesScatterPlotEvent.POINT_UNHOVERED, unhoveredPoint.trace);
  }

  private onClick(e: MouseEvent) {
    const clickedPoint = this.getPointFromMouseEvent(e);
    if (!clickedPoint) {
      return;
    }

    this.emit(TracesScatterPlotEvent.POINT_CLICKED, clickedPoint.trace);
  }

  private getPointFromMouseEvent(e: MouseEvent) {
    let element = e.target as SVGElement | null;

    while (element && element !== this.elements.svg) {
      if (element.hasAttribute('data-trace-id')) {
        const traceId = element.getAttribute('data-trace-id');
        return find(this.points, p => p.trace.id == traceId);
      }
      element = (element.parentElement as unknown) as SVGElement;
    }
  }

  dispose() {
    // Unbind events
    this.elements.svg.removeEventListener(
      'mousemove',
      this.binded.onMouseMove,
      false
    );
    this.elements.svg.removeEventListener(
      'mouseleave',
      this.binded.onMouseLeave,
      false
    );
    this.elements.svg.removeEventListener('click', this.binded.onClick, false);
  }
}
