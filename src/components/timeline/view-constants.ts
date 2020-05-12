class ViewConstants {
  readonly timeHeaderHeight = 20;
  readonly tickLength = 200; // in px
  readonly tickLineColor = '#eeeeee';
  readonly tickTextOffsetY = 14;
  readonly tickTextColor = '#999999';
  readonly tickTextFontSize = 10;

  readonly groupSeperatorLineColor = '#eeeeee';
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
  readonly spanBarViewportMargin = 5;
  get rowHeight() {
    return 2 * this.spanBarSpacing + this.spanBarHeight;
  }

  readonly spanLabelFontSize = 10;
  readonly spanLabelOffsetLeft = 5;
  readonly spanLabelSnappedOffsetLeft = 5;
  readonly spanLabelOffsetTop = 1;

  readonly spanErrorTriangleSize = 10;
  readonly spanErrorTriangleColor = '#ff0000';

  readonly selectionBorderColor = '#3E7CD6';
  readonly selectionBorderWidth = 1;
  readonly selectionBackgroundColor = 'rgba(58, 122, 217, 0.25)';
  readonly selectionTextColor = '#3E7CD6';
  readonly selectionTextSize = 10;
}

export default new ViewConstants();
