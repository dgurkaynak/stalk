class ViewConstants {
  readonly cursorLineColor = '#ccc';

  readonly timeHeaderHeight = 20;
  readonly tickLength = 200; // in px
  readonly tickLineColor = '#cccccc';
  readonly tickTextOffsetY = 14;
  readonly tickTextColor = '#999999';
  readonly tickTextFontSize = 10;

  readonly groupSeperatorLineColor = '#cccccc';
  readonly groupSeperatorLineWidth = 1;
  readonly groupLabelOffsetX = 3;
  readonly groupLabelOffsetY = 13;
  readonly groupLabelFontSize = 10;
  readonly groupLabelColor = '#000000';
  readonly groupPaddingTop = 20;
  readonly groupPaddingBottom = 10;

  readonly spanBarHeight = 18;
  readonly spanBarSpacing = 3;
  readonly spanBarRadius = 1;
  readonly spanBarMinWidth = 1;
  readonly spanBarViewportMargin = 3;
  get rowHeight() { return (2 * this.spanBarSpacing) + this.spanBarHeight; };

  readonly spanLabelFontSize = 10;
  readonly spanLabelOffsetLeft = 5;
  readonly spanLabelSnappedOffsetLeft = 5;
  readonly spanLabelOffsetTop = 1;

  readonly spanTooltipLineHeight = 20;
  readonly spanTooltipMaxWidth = 400;
  readonly spanTooltipBackgroundColor = '#ffffff';
  readonly spanTooltipFontSize = 10;
  readonly spanTooltipDurationTextColor = '#009900';
}

export default new ViewConstants();
