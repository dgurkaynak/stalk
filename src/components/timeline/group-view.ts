import isNumber from 'lodash/isNumber';
import forEach from 'lodash/forEach';
import every from 'lodash/every';
import { SpanGroup } from '../../model/span-group/span-group';
import { SpanView, SpanViewSharedOptions } from './span-view';
import SpanGroupNode from '../../model/span-group/span-group-node';
import {
  TimelineInteractableElementAttribute,
  TimelineInteractableElementType
} from './interaction';
import defaults from 'lodash/defaults';

const SVG_NS = 'http://www.w3.org/2000/svg';

export enum GroupLayoutType {
  FILL = 'fill',
  COMPACT = 'compact',
  WATERFALL = 'waterfall'
}

export class GroupViewStyle {
  spansContainerOffsetTop: number;
  labelFontSize: number;
  labelColor: string;
  labelOffsetX: number;
  labelOffsetY: number;
  seperatorLineColor: string;
  seperatorLineWidth: number;
}

export class GroupViewComputedStyles extends GroupViewStyle {
  y: number;
  isCollapsed: boolean;
}

export class GroupView {
  readonly spanGroup: SpanGroup;
  private spanViews: { [key: string]: SpanView } = {};
  get heightInRows() {
    return this.rowsAndSpanIntervals.length;
  } // How many rows containing
  private label: string;

  private spansContainer = document.createElementNS(SVG_NS, 'g');
  private seperatorLine = document.createElementNS(SVG_NS, 'line');
  private labelText = document.createElementNS(SVG_NS, 'text');
  private svgDefs?: SVGDefsElement;

  private layoutType = GroupLayoutType.FILL;
  private rowsAndSpanIntervals: number[][][] = [];
  private spanIdToRowIndex: { [key: string]: number } = {};

  private computedStyles: GroupViewComputedStyles;

  constructor(options: {
    group: SpanGroup;
    layoutType: GroupLayoutType;
    label?: string;
    style?: Partial<GroupViewStyle>;
  }) {
    this.spanGroup = options.group;
    this.layoutType = options.layoutType;
    this.label = options.label;

    const style = defaults(options.style, {
      spansContainerOffsetTop: 20,
      labelFontSize: 10,
      labelColor: '#000',
      labelOffsetX: 3,
      labelOffsetY: 13,
      seperatorLineColor: '#eee',
      seperatorLineWidth: 1
    });
    this.computedStyles = {
      ...style,
      y: 0,
      isCollapsed: false
    };

    this.seperatorLine.setAttribute('x1', '0');
    this.seperatorLine.setAttribute('x2', '0');
    this.seperatorLine.setAttribute('y1', '0');
    this.seperatorLine.setAttribute('y2', '0');
    this.seperatorLine.setAttribute('stroke', style.seperatorLineColor);
    this.seperatorLine.setAttribute(
      'stroke-width',
      style.seperatorLineWidth + ''
    );

    const prefixChar = this.computedStyles.isCollapsed ? '►' : '▼';
    this.labelText.textContent = `${prefixChar} ${this.label ||
      this.spanGroup.name}`;
    this.labelText.style.cursor = 'pointer';
    this.labelText.setAttribute('fill', style.labelColor);
    this.labelText.setAttribute('x', '0');
    this.labelText.setAttribute('y', '0');
    this.labelText.setAttribute('font-size', `${style.labelFontSize}px`);
    this.labelText.setAttribute(
      TimelineInteractableElementAttribute,
      TimelineInteractableElementType.GROUP_VIEW_LABEL_TEXT
    );
    this.labelText.setAttribute('data-group-id', this.spanGroup.id);
  }

  // can throw
  // - spanView.reuse
  init(options: {
    groupNamePanel: SVGGElement;
    timelinePanel: SVGGElement;
    svgDefs: SVGDefsElement;
    spanViewSharedOptions: SpanViewSharedOptions;
  }) {
    options.timelinePanel.appendChild(this.spansContainer);
    options.groupNamePanel.appendChild(this.seperatorLine);
    options.groupNamePanel.appendChild(this.labelText);
    this.svgDefs = options.svgDefs;

    // Set-up span views
    this.spanGroup.getAll().forEach(span => {
      // TODO: Reuse spanviews
      const spanView = new SpanView({
        span,
        sharedOptions: options.spanViewSharedOptions
      });
      spanView.reuse(span);
      this.spanViews[span.id] = spanView;
    });
  }

  dispose() {
    // Unmount self
    const parent1 = this.spansContainer.parentElement;
    parent1?.removeChild(this.spansContainer);
    const parent2 = this.seperatorLine.parentElement;
    parent2?.removeChild(this.seperatorLine);
    const parent3 = this.labelText.parentElement;
    parent3?.removeChild(this.labelText);

    // Unmount spans
    const spanViews = Object.values(this.spanViews);
    spanViews.forEach(v => v.dispose());
    this.spanViews = {};
    // TODO: Re-use spanviews!

    this.rowsAndSpanIntervals = [];
    this.spanIdToRowIndex = {};
  }

  toggleView() {
    this.computedStyles.isCollapsed = !this.computedStyles.isCollapsed;

    const prefixChar = this.computedStyles.isCollapsed ? '►' : '▼';
    this.labelText.textContent = `${prefixChar} ${this.label ||
      this.spanGroup.name}`;
    // this.updateLabelTextDecoration();

    this.layout();

    return !this.computedStyles.isCollapsed;
  }

  getSpanViewById(spanId: string) {
    return this.spanViews[spanId];
  }

  getAllSpanViews() {
    return Object.values(this.spanViews);
  }

  setSpanViewSharedOptions(newOptions: SpanViewSharedOptions) {
    Object.values(this.spanViews).forEach(s => s.setSharedOptions(newOptions));
  }

  updatePosition(options: { y: number }) {
    const {
      labelOffsetX,
      labelOffsetY,
      spansContainerOffsetTop
    } = this.computedStyles;
    this.spansContainer.setAttribute(
      'transform',
      `translate(0, ${options.y + spansContainerOffsetTop})`
    );
    this.seperatorLine.setAttribute('transform', `translate(0, ${options.y})`);
    this.labelText.setAttribute(
      'transform',
      `translate(${labelOffsetX}, ${options.y + labelOffsetY})`
    );
    this.computedStyles.y = options.y;
  }

  updateSeperatorLineWidths(width: number) {
    this.seperatorLine.setAttribute('x2', width + '');
  }

  updateLabelTextDecoration() {
    this.labelText.setAttribute(
      'text-decoration',
      this.computedStyles.isCollapsed ? 'underline' : ''
    );
    this.labelText.setAttribute(
      'font-style',
      this.computedStyles.isCollapsed ? 'italic' : ''
    );
  }

  bringSpanViewToTop(spanId: string) {
    const spanView = this.spanViews[spanId];
    spanView.mount({
      parent: this.spansContainer,
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
    const { spanGroup: group, spanViews } = this;
    const nodeQueue: SpanGroupNode[] = [
      ...group.rootNodes,
      ...group.orphanNodes
    ].sort((a, b) => {
      const spanA = group.get(a.spanId);
      const spanB = group.get(b.spanId);
      return spanA.startTime - spanB.startTime;
    });

    const allSpans = group.getAll();

    // If collapsed, hide all the spans
    if (this.computedStyles.isCollapsed) {
      forEach(spanViews, v => v.unmount());

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
            let parentRowIndex = this.spanIdToRowIndex[
              node.parentOrFollows.spanId
            ];
            if (isNumber(parentRowIndex)) minRowIndex = parentRowIndex + 1;
          }
          availableRowIndex = this.getAvailableRow({
            startTime,
            finishTime,
            minRowIndex
          });
          break;
        }
        case GroupLayoutType.WATERFALL: {
          availableRowIndex = i;
          break;
        }
      }

      if (!this.rowsAndSpanIntervals[availableRowIndex])
        this.rowsAndSpanIntervals[availableRowIndex] = [];
      this.rowsAndSpanIntervals[availableRowIndex].push([
        startTime,
        finishTime
      ]);
      this.spanIdToRowIndex[node.spanId] = availableRowIndex;

      spanView.showLabel();
      spanView.updateWidth();
      spanView.updateVerticalPosition(availableRowIndex, true);
      spanView.updateHorizontalPosition();

      spanView.mount({
        parent: this.spansContainer,
        svgDefs: this.svgDefs!
      });

      node.children
        .sort((a, b) => {
          const spanA = group.get(a.spanId);
          const spanB = group.get(b.spanId);
          return spanA.startTime - spanB.startTime;
        })
        .reverse() // because we're unshifting
        .forEach(childNode => nodeQueue.unshift(childNode));

      i++;
    } // while loop ended
  }

  handleAxisTranslate() {
    // Traverse just visible spans
    Object.keys(this.spanIdToRowIndex).forEach(spanId => {
      const spanView = this.spanViews[spanId];
      spanView.updateHorizontalPosition();
    });
  }

  handleAxisZoom() {
    // Traverse just visible spans
    Object.keys(this.spanIdToRowIndex).forEach(spanId => {
      const spanView = this.spanViews[spanId];
      const rowIndex = this.spanIdToRowIndex[spanId];
      spanView.updateVerticalPosition(rowIndex, true);
      spanView.updateHorizontalPosition();
      spanView.updateWidth();
    });
  }

  handleAxisUpdate() {
    // Traverse just visible spans
    Object.keys(this.spanIdToRowIndex).forEach(spanId => {
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
    startTime: number;
    finishTime: number;
    minRowIndex?: number;
  }) {
    let rowIndex = options.minRowIndex || 0;
    while (rowIndex < this.rowsAndSpanIntervals.length) {
      const spanIntervals = this.rowsAndSpanIntervals[rowIndex];

      const isRowAvaliable = every(spanIntervals, ([s, f]) => {
        if (options.finishTime <= s) return true;
        if (options.startTime >= f) return true;
        return false;
      });

      if (isRowAvaliable) return rowIndex;
      rowIndex++;
    }

    return rowIndex;
  }

  getComputedStyles() {
    return this.computedStyles;
  }

  static getPropsFromLabelText(el: Element) {
    return {
      id: el.getAttribute('data-group-id')
    };
  }
}
