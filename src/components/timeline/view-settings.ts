import Axis, { AxisEvent } from './axis';
import EventEmitterExtra from 'event-emitter-extra';
import ProcessGrouping from '../../model/grouping/process';


export enum TimelineViewSettingsEvent {
  GROUPING_KEY_CHANGED = 'tvs_grouping_key_changed'
}

export default class TimelineViewSettings extends EventEmitterExtra {
  private axis = new Axis([0, 0], [0, 0]);
  width = NaN; // In pixels
  height = NaN; // In pixels
  private _groupingKey = ProcessGrouping.KEY; // Do not forget to change default value of timeline sidebar dropdown
  get groupingKey() { return this._groupingKey; };
  readonly scrollToZoomFactor = 0.01;

  readonly cursorLineColor = '#ccc';
  showCursorLine = false;

  readonly groupSeperatorLineColor = '#cccccc';
  readonly groupSeperatorLineWidth = 1;
  readonly groupLabelOffsetX = 3;
  readonly groupLabelOffsetY = 13;
  readonly groupLabelFontSize = 12;
  readonly groupLabelColor = '#999999';
  readonly groupPaddingTop = 20;
  readonly groupPaddingBottom = 10;

  readonly spanBarHeight = 20;
  readonly spanBarSpacing = 3;
  readonly spanBarRadius = 5;
  readonly spanBarMinWidth = 2;
  readonly spanBarViewportMargin = 5;
  get rowHeight() { return (2 * this.spanBarSpacing) + this.spanBarHeight; };

  readonly spanLabelFontSize = 10;
  readonly spanLabelOffsetLeft = 5;
  readonly spanLabelSnappedOffsetLeft = 5;
  readonly spanLabelOffsetTop = 1;
  spanLabeling = 'operation-name'; // TODO
  readonly spanLogCircleRadius = 3;
  spanLogPreview = 'log.message'; // TODO

  getAxis() {
    return this.axis;
  }

  setAxis(axis: Axis) {
    this.axis.removeAllListeners();
    this.axis = axis;
    axis.on(AxisEvent.TRANSLATED, () => this.emit(AxisEvent.TRANSLATED));
    axis.on(AxisEvent.ZOOMED, () => this.emit(AxisEvent.ZOOMED));
    axis.on(AxisEvent.UPDATED, () => this.emit(AxisEvent.UPDATED));
  }

  setGroupingKey(groupingKey: string) {
    if (groupingKey === this._groupingKey) return false;
    this._groupingKey = groupingKey;
    this.emit(TimelineViewSettingsEvent.GROUPING_KEY_CHANGED);
  };
}
