import * as _ from 'lodash';
import { Group } from '../../model/grouping/group';
import SpanView from './span-view';
import GroupSpanNode from '../../model/grouping/group-span-node';
import ViewSettings from './view-settings';
import EventEmitterExtra from 'event-emitter-extra';
import { AxisEvent } from './axis';


const SVG_NS = 'http://www.w3.org/2000/svg';

enum Visibility {
  VISIBLE_OPEN,
  VISIBLE_COLLAPSED,
  HIDDEN
}

export enum GroupViewEvent {
  LAYOUT = 'layout',
  SPAN_CLICKED = 'span_clicked'
}


export default class GroupView extends EventEmitterExtra {
  private group: Group;
  private viewSettings: ViewSettings;
  private spanViews: { [key: string]: SpanView} = {};
  get heightInRows() { return this.rowsAndSpanIntervals.length; } // How many rows containing
  options = {
    isCollapsed: false
  };

  private container = document.createElementNS(SVG_NS, 'g');
  private seperatorLine = document.createElementNS(SVG_NS, 'line');
  private labelText = document.createElementNS(SVG_NS, 'text');

  private rowsAndSpanIntervals: number[][][] = [];
  private spanIdToRowIndex: { [key: string]: number } = {};

  private svgDefs?: SVGDefsElement;

  private viewPropertiesCache = {
    y: 0,
  };

  private binded = {
    onSpanClick: this.onSpanClick.bind(this),
    onLabelTextDoubleClick: this.onLabelTextDoubleClick.bind(this),
    handleAxisTranslate: this.handleAxisTranslate.bind(this),
    handleAxisZoom: this.handleAxisZoom.bind(this),
    handleAxisUpdate: this.handleAxisUpdate.bind(this),
  };

  constructor(options: {
    group: Group,
    viewSettings: ViewSettings
  }) {
    super();

    this.group = options.group;
    this.viewSettings = options.viewSettings;

    this.seperatorLine.setAttribute('x1', '0');
    this.seperatorLine.setAttribute('x2', this.viewSettings.width + '');
    this.seperatorLine.setAttribute('y1', '0');
    this.seperatorLine.setAttribute('y2', '0');
    this.seperatorLine.setAttribute('stroke', this.viewSettings.groupSeperatorLineColor);
    this.seperatorLine.setAttribute('stroke-width', this.viewSettings.groupSeperatorLineWidth + '');

    this.labelText.textContent = this.group.name;
    this.labelText.style.cursor = 'pointer';
    this.labelText.setAttribute('fill', this.viewSettings.groupLabelColor);
    this.labelText.setAttribute('x', '0');
    this.labelText.setAttribute('y', '0');
    this.labelText.setAttribute('font-size', `${this.viewSettings.groupLabelFontSize}px`);
  }

  init(options: {
    groupNamePanel: SVGGElement,
    timelinePanel: SVGGElement,
    svgDefs: SVGDefsElement
  }) {
    options.timelinePanel.appendChild(this.container);
    options.groupNamePanel.appendChild(this.seperatorLine);
    options.groupNamePanel.appendChild(this.labelText);
    this.svgDefs = options.svgDefs;

    this.container.addEventListener('click', this.binded.onSpanClick, false);
    this.labelText.addEventListener('dblclick', this.binded.onLabelTextDoubleClick, false);

    this.viewSettings.axis.on(AxisEvent.UPDATED, this.binded.handleAxisUpdate);
    this.viewSettings.axis.on(AxisEvent.TRANSLATED, this.binded.handleAxisTranslate);
    this.viewSettings.axis.on(AxisEvent.ZOOMED, this.binded.handleAxisZoom);

    // Set-up span views
    this.group.getAll().forEach((span) => {
      // TODO: Reuse spanviews
      const spanView = new SpanView({ span, viewSettings: this.viewSettings });
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

    this.container.removeEventListener('click', this.binded.onSpanClick, false);
    this.labelText.removeEventListener('dblclick', this.binded.onLabelTextDoubleClick, false);
    this.removeAllListeners();

    this.viewSettings.axis.removeListener(AxisEvent.UPDATED, [ this.binded.handleAxisUpdate ] as any);
    this.viewSettings.axis.removeListener(AxisEvent.TRANSLATED, [ this.binded.handleAxisTranslate ] as any);
    this.viewSettings.axis.removeListener(AxisEvent.ZOOMED, [ this.binded.handleAxisZoom ] as any);
  }

  private clickWaitTimeout: any;

  onSpanClick(e: MouseEvent) {
    if (this.clickWaitTimeout) {
      clearTimeout(this.clickWaitTimeout);
      this.clickWaitTimeout = null;
      this.onSpanDoubleClick(e);
      return;
    }

    this.clickWaitTimeout = setTimeout(() => {
      this.clickWaitTimeout = null;

      // Click event
      const clickedEl = e.target as Element;
      const spanContainer = clickedEl.closest('[data-span-id]');
      if (!spanContainer) return;
      const spanId = spanContainer.getAttribute('data-span-id')!;
      const spanView = this.spanViews[spanId];
      this.emit(GroupViewEvent.SPAN_CLICKED, spanView);
    }, 300);
  }

  onSpanDoubleClick(e: MouseEvent) {
    const clickedEl = e.target as Element;
    const spanContainer = clickedEl.closest('[data-span-id]');
    if (!spanContainer) return;
    const spanId = spanContainer.getAttribute('data-span-id')!;
    const spanView = this.spanViews[spanId];
    spanView.options.isCollapsed = !spanView.options.isCollapsed;
    spanView.updateLabelTextDecoration();

    this.layout();
  }

  onLabelTextDoubleClick(e: MouseEvent) {
    this.options.isCollapsed = !this.options.isCollapsed;
    this.updateLabelTextDecoration();
    this.layout();
  }

  findSpanView(spanId: string) {
    return this.spanViews[spanId];
  }

  updatePosition(options: { y: number }) {
    const { groupLabelOffsetX: groupTextOffsetX, groupLabelOffsetY: groupTextOffsetY } = this.viewSettings;
    this.container.setAttribute('transform', `translate(0, ${options.y})`);
    this.seperatorLine.setAttribute('transform', `translate(0, ${options.y})`);
    this.labelText.setAttribute('transform', `translate(${groupTextOffsetX}, ${options.y + groupTextOffsetY})`);
    this.viewPropertiesCache.y = options.y;
  }

  updateSeperatorLineWidths() {
    this.seperatorLine.setAttribute('x2', this.viewSettings.width + '');
  }

  updateLabelTextDecoration() {
    this.labelText.setAttribute('text-decoration', this.options.isCollapsed ? 'underline': '');
  }

  layout() {
    this.rowsAndSpanIntervals = [];
    this.spanIdToRowIndex = {};
    const { group, spanViews, container } = this;
    const nodeQueue: GroupSpanNode[] = [...group.rootNodes, ...group.orphanNodes].sort((a, b) => {
      const spanA = group.get(a.spanId);
      const spanB = group.get(b.spanId);
      return spanA.startTime - spanB.startTime;
    });

    // If collapsed, hide all the spans
    if (this.options.isCollapsed) {
      _.forEach(spanViews, v => v.unmount());

      this.rowsAndSpanIntervals = [];
      this.spanIdToRowIndex = {};
      this.emit(GroupViewEvent.LAYOUT);

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

          spanView.showLabel();
          spanView.updateHeight();
          spanView.updateWidth();
          spanView.updateVerticalPosition(availableRowIndex, true);
          spanView.updateHorizontalPosition();

          spanView.mount({
            groupContainer: container,
            svgDefs: this.svgDefs!
          });
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
        .reverse()
        .forEach(childNode => nodeQueue.unshift(childNode));
    } // while loop ended

    this.emit(GroupViewEvent.LAYOUT);
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
