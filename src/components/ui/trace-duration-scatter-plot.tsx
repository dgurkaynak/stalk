import React from 'react';
import { Trace } from '../../model/trace';
import * as d3 from 'd3';
import ColorManagers from '../color/managers';
import prettyMilliseconds from 'pretty-ms';

const MARGIN = { top: 20, right: 30, bottom: 30, left: 50 };


export interface TraceDurationScatterPlotProps {
  traces: Trace[],
  highlightedTrace?: Trace,
  width: number | string,
  height: number | string,
  style?: React.CSSProperties
  className?: string,
  onItemMouseEnter?: (t: Trace) => void,
  onItemMouseLeave?: (t: Trace) => void,
  onItemClick?: (t: Trace) => void
}


export class TraceDurationScatterPlot extends React.Component<TraceDurationScatterPlotProps> {
  svgRef: SVGSVGElement | null = null;
  tooltipRef: HTMLDivElement | null = null;


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
    if (!this.svgRef) {
      throw new Error('Could not render trace duration scatter plot, svg is not ready');
    }

    const { traces } = this.props;

    // Get computed style to get actual width & height
    const computedStyles = window.getComputedStyle(this.svgRef);
    const [ width, height ] = [ parseInt(computedStyles.width!, 10), parseInt(computedStyles.height!, 10) ];

    // Empty the svg
    while (this.svgRef.firstChild) {
      this.svgRef.removeChild(this.svgRef.firstChild);
    }

    const svg = d3.select(this.svgRef);

    // Get min and max time and also max duration
    let minTime = Infinity;
    let maxTime = -Infinity;
    let maxDuration = 0;
    traces.forEach((trace) => {
      minTime = Math.min(minTime, trace.startTime / 1000); // ms
      maxTime = Math.max(maxTime, trace.finishTime / 1000); // ms
      // TODO: Use the best duration unit for traces (ms, s, us...?)
      maxDuration = Math.max(maxDuration, trace.duration / 1000); // ms
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
      .call(
        d3.axisLeft(y)
          .ticks(7)
          .tickFormat((d: any) => {
            if (d === 0) return `0`;
            var m = (d / (1000 / 60));
            var s = (d / 1000);
            var ms = d;
            var us = (d * 1000);
            var ns = (d * 1000 * 1000);
            if (ns < 1000) return `${ns.toFixed(1)}ns`;
            if (us < 1000) return `${us.toFixed(1)}μs`;
            if (ms < 1000) return `${ms.toFixed(1)}ms`;
            if (s < 60) return `${s.toFixed(1)}s`;
            return `${m.toFixed(1)}m`;
          })
      );

    // Dots
    svg.append('g')
      .selectAll('dot')
      .data(traces)
      .enter()
      .append('circle')
      .attr('data-traceid', t => t.id)
      .attr('cx', t => x(t.startTime / 1000))
      .attr('cy', t => y(t.duration / 1000))
      .attr('r', 7)
      .style('fill', t => ColorManagers.operationName.colorFor(t.name) as string)
      .style('opacity', 0.75)
      .style('cursor', 'pointer')
      .on('click', t => this.props.onItemClick && this.props.onItemClick(t))
      .on('mouseenter', t => {
        this.highlight(t);
        const coords = {
          x: x(t.startTime / 1000),
          y: y(t.duration / 1000)
        };
        d3
          .select(this.tooltipRef)
          .style('display', 'block')
          .style('opacity', 0)
          .style('top', `${coords.y - 13}px`)
          .style('left', `${coords.x + 15}px`)
          .text(`${t.name}, ${prettyMilliseconds(t.duration / 1000, { formatSubMilliseconds: true })}`)
          .transition()
          .duration(100)
          .style('opacity', 1);
        this.props.onItemMouseEnter && this.props.onItemMouseEnter(t);
      })
      .on('mouseleave', t => {
        this.unhighlight(t);
        d3
          .select(this.tooltipRef)
          .style('display', 'none');
        this.props.onItemMouseLeave && this.props.onItemMouseLeave(t);
      });
  }


  highlight(trace: Trace) {
    const svg = d3.select(this.svgRef);
    svg.select(`circle[data-traceid="${trace.id}"]`)
      .transition()
      .duration(100)
      .attr('r', 10)
      .style('opacity', 1);
  }


  unhighlight(trace: Trace) {
    const svg = d3.select(this.svgRef);
    svg.select(`circle[data-traceid="${trace.id}"]`)
      .transition()
      .duration(100)
      .attr('r', 7)
      .style('opacity', 0.75);
  }


  render() {
    const { width, height, style } = this.props;
    return (
      <div style={{ position: 'relative' }}>
        <div
          className="tooltip"
          ref={ref => { this.tooltipRef = ref }}
          style={{
            position: 'absolute',
            lineHeight: '20px',
            padding: '3px 6px',
            zIndex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            borderRadius: 3,
            color: '#fff',
            display: 'none',
            fontSize: 12
          }}
        ></div>
        <svg
          ref={ref => { this.svgRef = ref }}
          width={width}
          height={height}
          style={style}
          className={this.props.className}
        ></svg>
      </div>
    );
  }
}


export default TraceDurationScatterPlot;
