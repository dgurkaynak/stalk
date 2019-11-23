export const TimelineInteractableElementAttribute = 'data-view-type';

export enum TimelineInteractableElementType {
  GROUP_VIEW_LABEL_TEXT = 'group_view_label_text',
  SPAN_VIEW_CONTAINER = 'span_view_container'
}

export interface TimelineInteractedElementObject {
  type: TimelineInteractableElementType;
  element: SVGElement;
}
