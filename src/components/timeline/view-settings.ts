import Axis from './axis';
import EventEmitterExtra from 'event-emitter-extra';


export default class TimelineViewSettings extends EventEmitterExtra {
  axis = new Axis([0, 0], [0, 0]);
  width = NaN;
  height = NaN;

  barHeight = 20;
  barSpacing = 3;
  barRadius = 3;

  groupSeperatorLineColor = '#cccccc';
  groupSeperatorLineWidth = 1;
  groupLabelOffsetX = 3;
  groupLabelOffsetY = 13;
  groupLabelFontSize = 12;
  groupLabelColor = '#999999';
  groupPaddingTop = 20;
  groupPaddingBottom = 10;

  scrollToZoomFactor = 0.01;
}
