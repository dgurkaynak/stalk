class ViewConstants {
  readonly cursorLineColor = '#ccc';

  readonly groupSeperatorLineColor = '#cccccc';
  readonly groupSeperatorLineWidth = 1;
  readonly groupLabelOffsetX = 3;
  readonly groupLabelOffsetY = 13;
  readonly groupLabelFontSize = 12;
  readonly groupLabelColor = '#999999';
  readonly groupPaddingTop = 20;
  readonly groupPaddingBottom = 10;

  readonly spanBarHeight = 18;
  readonly spanBarSpacing = 3;
  readonly spanBarRadius = 0;
  readonly spanBarMinWidth = 1;
  readonly spanBarViewportMargin = 3;
  get rowHeight() { return (2 * this.spanBarSpacing) + this.spanBarHeight; };

  readonly spanLabelFontSize = 10;
  readonly spanLabelOffsetLeft = 5;
  readonly spanLabelSnappedOffsetLeft = 5;
  readonly spanLabelOffsetTop = 1;
  readonly spanLogCircleRadius = 3;
}

export default new ViewConstants();
