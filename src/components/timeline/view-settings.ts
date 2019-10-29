import Axis, { AxisEvent } from './axis';
import EventEmitterExtra from 'event-emitter-extra';
import { SpanGroupingOptions } from '../../model/span-grouping/span-grouping';
import processGroupingOptions from '../../model/span-grouping/process';
import { operationColoringOptions, SpanColoringOptions } from '../../model/span-coloring-manager';
import { operationLabellingOptions, SpanLabellingOptions } from '../../model/span-labelling-manager';
import { GroupLayoutType } from '../timeline/group-view';


export enum TimelineViewSettingsEvent {
  SPAN_GROUPING_CHANGED = 'tvs_span_grouping_changed',
  SPAN_COLORING_CHANGED = 'tvs_span_coloring_changed',
  SPAN_LABELLING_CHANGED = 'tvs_span_labelling_changed',
  GROUP_LAYOUT_TYPE_CHANGED = 'tvs_group_layout_type_changed',
}

export default class TimelineViewSettings extends EventEmitterExtra {
  private axis = new Axis([0, 0], [0, 0]);
  width = NaN; // In pixels
  height = NaN; // In pixels
  readonly scrollToZoomFactor = 0.01;

  readonly cursorLineColor = '#ccc';
  showCursorLine = true;

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

  private _spanGroupingOptions = processGroupingOptions;  // Do not forget to change default value of timeline header menu
  get spanGroupingOptions() {
    return this._spanGroupingOptions;
  };

  private _spanColoringOptions = operationColoringOptions;  // Do not forget to change default value of timeline header menu
  get spanColorFor() {
    return this._spanColoringOptions.colorBy;
  }

  private _spanLabellingOptions = operationLabellingOptions; // Do not forget to change default value of timeline header menu
  get spanLabelFor() {
    return this._spanLabellingOptions.labelBy;
  }

  private _groupLayoutType: GroupLayoutType = GroupLayoutType.COMPACT;
  get groupLayoutType() {
    return this._groupLayoutType;
  }

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

  setSpanGroupingOptions(spanGroupingOptions: SpanGroupingOptions, force = false) {
    if (!force && this._spanGroupingOptions.key === spanGroupingOptions.key) return false;
    this._spanGroupingOptions = spanGroupingOptions;
    this.emit(TimelineViewSettingsEvent.SPAN_GROUPING_CHANGED);
  };

  setSpanColoringOptions(spanColoringOptions: SpanColoringOptions, force = false) {
    if (!force && this._spanColoringOptions.key === spanColoringOptions.key) return false;
    this._spanColoringOptions = spanColoringOptions;
    this.emit(TimelineViewSettingsEvent.SPAN_COLORING_CHANGED);
  }

  setSpanLabellingOptions(spanlabellingOptions: SpanLabellingOptions, force = false) {
    if (!force && this._spanLabellingOptions.key === spanlabellingOptions.key) return false;
    this._spanLabellingOptions = spanlabellingOptions;
    this.emit(TimelineViewSettingsEvent.SPAN_LABELLING_CHANGED);
  }

  setGroupLayoutType(layoutType: GroupLayoutType) {
    if (this._groupLayoutType === layoutType) return false;
    this._groupLayoutType = layoutType;
    this.emit(TimelineViewSettingsEvent.GROUP_LAYOUT_TYPE_CHANGED);
  }
}
