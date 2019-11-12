import * as _ from 'lodash';
import { SpanGroup } from '../../model/span-group/span-group';
import SpanView, { SpanViewSharedOptions } from './span-view';
import SpanGroupNode from '../../model/span-group/span-group-node';
import vc from './view-constants';
import { TimelineInteractableElementAttribute, TimelineInteractableElementType } from './interaction';


const SVG_NS = 'http://www.w3.org/2000/svg';

export enum GroupLayoutType {
  FILL = 'fill',
  COMPACT = 'compact',
  WATERFALL = 'waterfall'
}


export default class GroupView {
  readonly spanGroup: SpanGroup;
  private spanViews: { [key: string]: SpanView} = {};
  get heightInRows() { return this.rowsAndSpanIntervals.length; } // How many rows containing
  options = {
    isCollapsed: false
  };

  private container = document.createElementNS(SVG_NS, 'g');
  private seperatorLine = document.createElementNS(SVG_NS, 'line');
  private labelText = document.createElementNS(SVG_NS, 'text');
  private svgDefs?: SVGDefsElement;

  private layoutType = GroupLayoutType.FILL;
  private rowsAndSpanIntervals: number[][][] = [];
  private spanIdToRowIndex: { [key: string]: number } = {};

  private viewPropertiesCache = {
    y: 0,
  };

  constructor(group: SpanGroup, options: {
    width: number,
    layoutType: GroupLayoutType
  }) {
    this.spanGroup = group;
    this.layoutType = options.layoutType;

    this.seperatorLine.setAttribute('x1', '0');
    this.seperatorLine.setAttribute('x2', options.width + '');
    this.seperatorLine.setAttribute('y1', '0');
    this.seperatorLine.setAttribute('y2', '0');
    this.seperatorLine.setAttribute('stroke', vc.groupSeperatorLineColor);
    this.seperatorLine.setAttribute('stroke-width', vc.groupSeperatorLineWidth + '');

    this.labelText.textContent = this.spanGroup.name;
    this.labelText.style.cursor = 'pointer';
    this.labelText.setAttribute('fill', vc.groupLabelColor);
    this.labelText.setAttribute('x', '0');
    this.labelText.setAttribute('y', '0');
    this.labelText.setAttribute('font-size', `${vc.groupLabelFontSize}px`);
    this.labelText.setAttribute(TimelineInteractableElementAttribute, TimelineInteractableElementType.GROUP_VIEW_LABEL_TEXT);
    this.labelText.setAttribute('data-group-id', this.spanGroup.id);
  }

  init(options: {
    groupNamePanel: SVGGElement,
    timelinePanel: SVGGElement,
    svgDefs: SVGDefsElement,
    spanViewSharedOptions: SpanViewSharedOptions
  }) {
    options.timelinePanel.appendChild(this.container);
    options.groupNamePanel.appendChild(this.seperatorLine);
    options.groupNamePanel.appendChild(this.labelText);
    this.svgDefs = options.svgDefs;

    // Set-up span views
    this.spanGroup.getAll().forEach((span) => {
      // TODO: Reuse spanviews
      const spanView = new SpanView(span, options.spanViewSharedOptions);
      spanView.reuse(span);
      this.spanViews[span.id] = spanView;
    });
  }

  dispose() {
    // Unmount self
    const parent1 = this.container.parentElement;
    parent1 && parent1.removeChild(this.container);
    const parent2 = this.seperatorLine.parentElement;
    parent2 && parent2.removeChild(this.seperatorLine);
    const parent3 = this.labelText.parentElement;
    parent3 && parent3.removeChild(this.labelText);

    // Unmount spans
    const spanViews = Object.values(this.spanViews);
    spanViews.forEach(v => v.dispose());
    this.spanViews = {};
    // TODO: Re-use spanviews!

    this.rowsAndSpanIntervals = [];
    this.spanIdToRowIndex = {};
  }

  toggleView() {
    this.options.isCollapsed = !this.options.isCollapsed;
    this.updateLabelTextDecoration();
    this.layout();
  }

  getSpanViewById(spanId: string) {
    return this.spanViews[spanId];
  }

  getAllSpanViews() {
    return Object.values(this.spanViews);
  }

  updatePosition(options: { y: number }) {
    const { groupLabelOffsetX: groupTextOffsetX, groupLabelOffsetY: groupTextOffsetY } = vc;
    this.container.setAttribute('transform', `translate(0, ${options.y})`);
    this.seperatorLine.setAttribute('transform', `translate(0, ${options.y})`);
    this.labelText.setAttribute('transform', `translate(${groupTextOffsetX}, ${options.y + groupTextOffsetY})`);
    this.viewPropertiesCache.y = options.y;
  }

  updateSeperatorLineWidths(width: number) {
    this.seperatorLine.setAttribute('x2', width + '');
  }

  updateLabelTextDecoration() {
    this.labelText.setAttribute('text-decoration', this.options.isCollapsed ? 'underline': '');
    this.labelText.setAttribute('font-style', this.options.isCollapsed ? 'italic': '');
  }

  bringSpanViewToTop(spanId: string) {
    const spanView = this.spanViews[spanId];
    spanView.mount({
      groupContainer: this.container,
      svgDefs: this.svgDefs!
    });
  }

  setLayoutType(layoutType: GroupLayoutType) {
    this.layoutType = layoutType;
    // TODO: Call .layout() maybe?
  }

  layout() {
    this.rowsAndSpanIntervals = [];
    this.spanIdToRowIndex = {};
    const { spanGroup: group, spanViews, container } = this;
    const nodeQueue: SpanGroupNode[] = [...group.rootNodes, ...group.orphanNodes].sort((a, b) => {
      const spanA = group.get(a.spanId);
      const spanB = group.get(b.spanId);
      return spanA.startTime - spanB.startTime;
    });

    // If collapsed, hide all the spans
    if (this.options.isCollapsed) {
      _.forEach(spanViews, v => v.unmount());

      this.rowsAndSpanIntervals = [];
      this.spanIdToRowIndex = {};

      return;
    }

    // Depth-first search
    let i = 0;
    while (nodeQueue.length > 0) {
      const node = nodeQueue.shift()!;
      const spanView = spanViews[node.spanId];

      const { startTime, finishTime } = spanView.span;
      let availableRowIndex = 0;

      switch (this.layoutType) {
        case GroupLayoutType.FILL: {
          availableRowIndex = this.getAvailableRow({ startTime, finishTime });
          break;
        }
        case GroupLayoutType.COMPACT: {
          let minRowIndex = 0;
          if (node.parentOrFollows) {
            let parentRowIndex = this.spanIdToRowIndex[node.parentOrFollows.spanId];
            if (_.isNumber(parentRowIndex)) minRowIndex = parentRowIndex + 1;
          }
          availableRowIndex = this.getAvailableRow({ startTime, finishTime, minRowIndex });
          break;
        }
        case GroupLayoutType.WATERFALL: {
          availableRowIndex = i;
          break;
        }
      }

      if (!this.rowsAndSpanIntervals[availableRowIndex]) this.rowsAndSpanIntervals[availableRowIndex] = [];
      this.rowsAndSpanIntervals[availableRowIndex].push([startTime, finishTime]);
      this.spanIdToRowIndex[node.spanId] = availableRowIndex;

      spanView.showLabel();
      spanView.showLogs();
      spanView.updateWidth();
      spanView.updateVerticalPosition(availableRowIndex, true);
      spanView.updateHorizontalPosition();

      spanView.mount({
        groupContainer: container,
        svgDefs: this.svgDefs!
      });

      node.children
        .sort((a, b) => {
          const spanA = group.get(a.spanId);
          const spanB = group.get(b.spanId);
          return spanA.startTime - spanB.startTime;
        })
        .reverse()
        .forEach(childNode => nodeQueue.unshift(childNode));

      i++;
    } // while loop ended

  }

  handleAxisTranslate() {
    // Traverse just visible spans
    Object.keys(this.spanIdToRowIndex).forEach((spanId) => {
      const spanView = this.spanViews[spanId];
      spanView.updateHorizontalPosition();
    });
  }

  handleAxisZoom() {
    // Traverse just visible spans
    Object.keys(this.spanIdToRowIndex).forEach((spanId) => {
      const spanView = this.spanViews[spanId];
      const rowIndex = this.spanIdToRowIndex[spanId];
      spanView.updateVerticalPosition(rowIndex, true);
      spanView.updateHorizontalPosition();
      spanView.updateWidth();
    });
  }

  handleAxisUpdate() {
    // Traverse just visible spans
    Object.keys(this.spanIdToRowIndex).forEach((spanId) => {
      const spanView = this.spanViews[spanId];
      const rowIndex = this.spanIdToRowIndex[spanId];
      spanView.updateVerticalPosition(rowIndex, true);
      spanView.updateHorizontalPosition();
      spanView.updateWidth();
    });
  }

  /**
   * TODO: Bunun daha efficent halini yazabilirsin:
   * Her row'daki (`rowsAndSpanIntervals`) interval'larin sirali oldugundan eminsin
   * Eger `options.finishTime` bir defa `interval[0]`den kucuk oldugunda hep kucuk olacak.
   */
  getAvailableRow(options: {
    startTime: number,
    finishTime: number,
    minRowIndex?: number
  }) {
    let rowIndex = options.minRowIndex || 0;
    while (rowIndex < this.rowsAndSpanIntervals.length) {
      const spanIntervals = this.rowsAndSpanIntervals[rowIndex];

      const isRowAvaliable = _.every(spanIntervals, ([s, f]) => {
        if (options.finishTime <= s) return true;
        if (options.startTime >= f) return true;
        return false;
      });

      if (isRowAvaliable) return rowIndex;
      rowIndex++;
    }

    return rowIndex;
  }

  getViewPropertiesCache() {
    return { ...this.viewPropertiesCache };
  }

  static getPropsFromLabelText(el: Element) {
    return {
      id: el.getAttribute('data-group-id')
    };
  }
}
