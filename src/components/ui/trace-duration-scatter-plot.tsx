import React from 'react';
import { Trace } from '../../model/trace';
import * as d3 from 'd3';
import ColorManagers from '../color/managers';

const MARGIN = { top: 20, right: 30, bottom: 30, left: 50 };


export interface TraceDurationScatterPlotProps {
  traces: Trace[],
  highlightedTrace?: Trace,
  width: number | string,
  height: number | string,
  style?: React.CSSProperties
}


export class TraceDurationScatterPlot extends React.Component<TraceDurationScatterPlotProps> {
  svg: SVGSVGElement | null = null;


  componentDidMount() {
    this.renderChart();
  }


  shouldComponentUpdate(nextProps: TraceDurationScatterPlotProps) {
    if (this.props.traces !== nextProps.traces) {
      this.renderChart();
    }

    if (this.props.highlightedTrace !== nextProps.highlightedTrace) {
      if (this.props.highlightedTrace) this.unhighlight(this.props.highlightedTrace);
      if (nextProps.highlightedTrace) this.highlight(nextProps.highlightedTrace);
    }

    return false;
  }


  renderChart() {
    if (!this.svg) {
      throw new Error('Could not render trace duration scatter plot, svg is not ready');
    }

    const { traces } = this.props;

    // Get computed style to get actual width & height
    const computedStyles = window.getComputedStyle(this.svg);
    const [ width, height ] = [ parseInt(computedStyles.width!, 10), parseInt(computedStyles.height!, 10) ];

    // Empty the svg
    while (this.svg.firstChild) {
      this.svg.removeChild(this.svg.firstChild);
    }

    const svg = d3.select(this.svg);

    // Get min and max time and also max duration
    let minTime = Infinity;
    let maxTime = -Infinity;
    let maxDuration = 0;
    traces.forEach((trace) => {
      minTime = Math.min(minTime, trace.startTime / 1000); // ms
      maxTime = Math.max(maxTime, trace.finishTime / 1000); // ms
      maxDuration = Math.max(maxDuration, trace.duration / 1000 / 1000); // s
    });

    // X axis
    const x = d3.scaleTime()
      .domain([ minTime, maxTime ])
      .range([ MARGIN.left, width - MARGIN.right ]);

    svg.append('g')
      .attr('transform', `translate(0, ${height - MARGIN.bottom})`)
      .call(d3.axisBottom(x));

    // Y axis
    const y = d3.scaleLinear()
      .domain([ 0, maxDuration ])
      .range([ height - MARGIN.bottom, MARGIN.top ]);

    svg.append('g')
      .attr('transform', `translate(${MARGIN.left}, 0)`)
      .call(d3.axisLeft(y));

    // Dots
    svg.append('g')
      .selectAll('dot')
      .data(traces)
      .enter()
      .append('circle')
      .attr('data-traceId', t => t.id)
      .attr('cx', t => x(t.startTime / 1000))
      .attr('cy', t => y(t.duration / 1000 / 1000))
      .attr('r', 7)
      .style('fill', t => ColorManagers.operationName.colorFor(t.name) as string)
      .style('opacity', 0.75)
      .on('mouseenter', t => this.highlight(t))
      .on('mouseleave', t => this.unhighlight(t));
  }


  highlight(trace: Trace) {
    const svg = d3.select(this.svg);
    svg.select(`circle[data-traceId="${trace.id}"]`)
      .transition()
      .duration(100)
      .attr('r', 10)
      .style('opacity', 1);
  }


  unhighlight(trace: Trace) {
    const svg = d3.select(this.svg);
    svg.select(`circle[data-traceId="${trace.id}"]`)
      .transition()
      .duration(100)
      .attr('r', 7)
      .style('opacity', 0.75);
  }


  render() {
    const { width, height, style } = this.props;
    return (
      <svg
        ref={ref => { this.svg = ref }}
        width={width}
        height={height}
        style={style}
      ></svg>
    );
  }
}


export default TraceDurationScatterPlot;
