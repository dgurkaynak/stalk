import * as _ from 'lodash';
import { Group } from '../../model/grouping/group';
import SpanView from './span-view';
import GroupSpanNode from '../../model/grouping/group-span-node';
import ViewSettings from './view-settings';


const SVG_NS = 'http://www.w3.org/2000/svg';

enum Visibility {
  VISIBLE_OPEN,
  VISIBLE_COLLAPSED,
  HIDDEN
}


export default class GroupView {
  group: Group;
  viewSettings: ViewSettings;
  spanViews: { [key: string]: SpanView} = {};
  get height() { return this.rowsAndSpanIntervals.length; }
  options = {
    isCollapsed: false
  };

  private g = document.createElementNS(SVG_NS, 'g');
  private seperatorLine = document.createElementNS(SVG_NS, 'line');
  private groupLabelText = document.createElementNS(SVG_NS, 'text');

  private rowsAndSpanIntervals: number[][][] = [];
  private spanIdToRowIndex: { [key: string]: number } = {};

  constructor(options: {
    group: Group,
    viewSettings: ViewSettings
  }) {
    this.group = options.group;
    this.viewSettings = options.viewSettings;

    this.seperatorLine.setAttribute('x1', '0');
    this.seperatorLine.setAttribute('x2', this.viewSettings.width + '');
    this.seperatorLine.setAttribute('y1', '0');
    this.seperatorLine.setAttribute('y2', '0');
    this.seperatorLine.setAttribute('stroke', this.viewSettings.groupSeperatorLineColor);
    this.seperatorLine.setAttribute('stroke-width', this.viewSettings.groupSeperatorLineWidth + '');

    this.groupLabelText.textContent = this.group.name;
    this.groupLabelText.setAttribute('fill', this.viewSettings.groupLabelColor);
    this.groupLabelText.setAttribute('x', '0');
    this.groupLabelText.setAttribute('y', '0');
    this.groupLabelText.setAttribute('font-size', `${this.viewSettings.groupLabelFontSize}px`);
  }

  mount(options: {
    groupNamePanel: SVGGElement,
    timelinePanel: SVGGElement
  }) {
    options.timelinePanel.appendChild(this.g);
    options.groupNamePanel.appendChild(this.seperatorLine);
    options.groupNamePanel.appendChild(this.groupLabelText);
  }

  dispose() {
    // Unmount self
    const parent1 = this.g.parentElement;
    parent1 && parent1.removeChild(this.g);
    const parent2 = this.seperatorLine.parentElement;
    parent2 && parent2.removeChild(this.seperatorLine);
    const parent3 = this.groupLabelText.parentElement;
    parent3 && parent3.removeChild(this.groupLabelText);

    // Unmount spans
    const spanViews = Object.values(this.spanViews);
    spanViews.forEach(v => v.unmount());
    this.spanViews = {};
    // TODO: Re-use spanviews!

    this.rowsAndSpanIntervals = [];
    this.spanIdToRowIndex = {};
  }

  setupSpans() {
    this.group.getAll().forEach((span) => {
        // TODO: Reuse spanviews
        const spanView = new SpanView({ span, viewSettings: this.viewSettings });
        spanView.reuse(span);
        this.spanViews[span.id] = spanView;
    });

    this.layout();
  }

  updatePosition(options: { y: number }) {
    const { groupPaddingTop, groupLabelOffsetX: groupTextOffsetX, groupLabelOffsetY: groupTextOffsetY } = this.viewSettings;
    this.g.setAttribute('transform', `translate(0, ${options.y + groupPaddingTop})`);
    this.seperatorLine.setAttribute('transform', `translate(0, ${options.y})`);
    this.groupLabelText.setAttribute('transform', `translate(${groupTextOffsetX}, ${options.y + groupTextOffsetY})`);
  }

  updateSeperatorLineWidths() {
    this.seperatorLine.setAttribute('x2', this.viewSettings.width + '');
  }

  layout() {
    this.rowsAndSpanIntervals = [];
    this.spanIdToRowIndex = {};
    const { group, spanViews, g } = this;
    const nodeQueue: GroupSpanNode[] = [...group.rootNodes, ...group.orphanNodes].sort((a, b) => {
      const spanA = group.get(a.spanId);
      const spanB = group.get(b.spanId);
      return spanA.startTime - spanB.startTime;
    });

    // If collapsed, hide all the spans
    if (this.options.isCollapsed) {
      _.forEach(spanViews, v => v.unmount());
      return;
    }

    const visibilityMap: { [key: string]: Visibility } = {};

    // Depth-first search
    while (nodeQueue.length > 0) {
      const node = nodeQueue.shift()!;
      const spanView = spanViews[node.spanId];

      // Calculate visibility map
      let visibility: Visibility;
      if (node.parent) {
        // Span has a parent, check parent visibility
        const parentVisibility = visibilityMap[node.parent.spanId];

        switch (parentVisibility) {
          case Visibility.HIDDEN:
          case Visibility.VISIBLE_COLLAPSED: {
            visibility = Visibility.HIDDEN;
            break;
          }

          case Visibility.VISIBLE_OPEN: {
            visibility = spanView.options.isCollapsed ? Visibility.VISIBLE_COLLAPSED : Visibility.VISIBLE_OPEN;
            break;
          }

          default: throw new Error('Unknown parent span visiblity');
        }
      } else {
        // Span does not have parent (root or oprhan)
        visibility = spanView.options.isCollapsed ? Visibility.VISIBLE_COLLAPSED : Visibility.VISIBLE_OPEN;
      }

      // Save visibility value for children
      visibilityMap[node.spanId] = visibility;

      // Apply the calculated visibility
      switch (visibility) {
        case Visibility.HIDDEN: {
          spanView.unmount();
          break;
        }

        case Visibility.VISIBLE_COLLAPSED:
        case Visibility.VISIBLE_OPEN: {
          const { startTime, finishTime } = spanView.span!;
          const availableRowIndex = this.getAvailableRow({ startTime, finishTime });
          if (!this.rowsAndSpanIntervals[availableRowIndex]) this.rowsAndSpanIntervals[availableRowIndex] = [];
          this.rowsAndSpanIntervals[availableRowIndex].push([startTime, finishTime]);
          this.spanIdToRowIndex[node.spanId] = availableRowIndex;

          spanView.updatePosition({ rowIndex: availableRowIndex });
          spanView.mount(g);
          break;
        }

        default: throw new Error('Unknown span visibility');
      }

      node.children
        .sort((a, b) => {
          const spanA = group.get(a.spanId);
          const spanB = group.get(b.spanId);
          return spanA.startTime - spanB.startTime;
        })
        .forEach(childNode => nodeQueue.unshift(childNode));
    } // while loop ended
  }

  updateVisibleSpanPositions() {
    Object.keys(this.spanIdToRowIndex).forEach((spanId) => {
      const spanView = this.spanViews[spanId];
      const rowIndex = this.spanIdToRowIndex[spanId];
      spanView.updatePosition({ rowIndex });
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
  }) {
    let rowIndex = 0;
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
}
