import * as _ from 'lodash';
import SpanView from './span-view';
import GroupView from './group-view';
import GroupSpanNode from '../../model/grouping/group-span-node';


enum Visibility {
  VISIBLE_OPEN,
  VISIBLE_COLLAPSED,
  HIDDEN
}


export default class LayoutManager {
  private rowsAndSpanIntervals: number[][][] = [];
  spanIdToRowIndex: { [key: string]: number } = {};
  get height() { return this.rowsAndSpanIntervals.length; }

  constructor(private groupView: GroupView) {
    // noop
  }

  trigger() {
    this.rowsAndSpanIntervals = [];
    this.spanIdToRowIndex = {};
    const { group, spanViews, g } = this.groupView;
    const nodeQueue: GroupSpanNode[] = [...group.rootNodes, ...group.orphanNodes].sort((a, b) => {
      const spanA = group.get(a.spanId);
      const spanB = group.get(b.spanId);
      return spanA.startTime - spanB.startTime;
    });

    // If collapsed, hide all the spans
    if (this.groupView.options.isCollapsed) {
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

      //
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

          this.updateSpanPlacement(spanView);
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
    }
  }

  updateSpanPlacement(spanView: SpanView) {
    const rowIndex = this.spanIdToRowIndex[spanView.span!.id];
    spanView.updatePosition({ rowIndex });
  }

  updateVisibleSpansPlacement() {
    Object.keys(this.spanIdToRowIndex).forEach((spanId) => {
      const spanView = this.groupView.spanViews[spanId];
      this.updateSpanPlacement(spanView);
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

  reset() {
    this.rowsAndSpanIntervals = [];
    this.spanIdToRowIndex = {};
  }
}
