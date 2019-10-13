import * as _ from 'lodash';
import { Stage } from '../../model/stage';
import GroupView, { GroupViewEvent } from './group-view';
import Axis from './axis';
import ViewSettings from './view-settings';
import SpanView from './span-view';
import EventEmitterExtra from 'event-emitter-extra';
import AnnotationManager from './annotation';

const SVG_NS = 'http://www.w3.org/2000/svg';

export enum TimelineViewEvent {
  SPAN_SELECTED = 'span_selected'
}


export default class TimelineView extends EventEmitterExtra {
  private svg = document.createElementNS(SVG_NS, 'svg');

  private defs = document.createElementNS(SVG_NS, 'defs');
  private viewportClipPath = document.createElementNS(SVG_NS, 'clipPath');
  private viewportClipPathRect = document.createElementNS(SVG_NS, 'rect');
  private cursorLine = document.createElementNS(SVG_NS, 'line');

  private viewportContainer = document.createElementNS(SVG_NS, 'g');
  private groupNamePanel = document.createElementNS(SVG_NS, 'g');
  private timelinePanel = document.createElementNS(SVG_NS, 'g');
  private annotationUnderlayPanel = document.createElementNS(SVG_NS, 'g');
  private annotationOverlayPanel = document.createElementNS(SVG_NS, 'g');
  private panelTranslateY = 0;

  private isMouseDown = false;

  private stage?: Stage;
  private viewSettings = new ViewSettings();
  private groupViews: { [key: string]: GroupView} = {};
  private contentHeight = 0; // in pixels
  private sidebarWidth = 0;

  annotation = new AnnotationManager({
    timelineView: this,
    underlayPanel: this.annotationUnderlayPanel,
    overlayPanel: this.annotationOverlayPanel,
    viewSettings: this.viewSettings
  });

  private binded = {
    onMouseDown: this.onMouseDown.bind(this),
    onMouseMove: this.onMouseMove.bind(this),
    onMouseUp: this.onMouseUp.bind(this),
    onMouseLeave: this.onMouseLeave.bind(this),
    onWheel: this.onWheel.bind(this),
  };


  constructor(options?: {
    viewSettings?: ViewSettings
  }) {
    super();

    if (options && options.viewSettings) this.viewSettings = options.viewSettings;
    this.svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
    this.svg.classList.add('timeline-svg');

    this.cursorLine.setAttribute('x1', '0');
    this.cursorLine.setAttribute('x2', '0');
    this.cursorLine.setAttribute('y1', '0');
    this.cursorLine.setAttribute('stroke', '#cccccc');
    this.cursorLine.setAttribute('stroke-width', '1');
    this.cursorLine.style.display = 'none';
    this.svg.appendChild(this.cursorLine);
  }


  init(parentElement: HTMLElement, options?: {
    width?: number,
    height?: number,
  }) {
    let width = options && options.width;
    let height = options && options.height;
    if (!width || !height) {
      const { offsetWidth, offsetHeight } = parentElement;
      width = offsetWidth;
      height = offsetHeight;
    }
    this.resize(width, height);
    this.setupPanels();
    this.bindEvents();

    parentElement.appendChild(this.svg);
  }


  resize(width: number, height: number) {
    this.viewSettings.width = width;
    this.viewSettings.height = height;

    this.svg.setAttribute('width', `${width}`);
    this.svg.setAttribute('height', `${height}`);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    this.cursorLine.setAttribute('y2', this.viewSettings.height + '');

    this.viewportClipPathRect.setAttribute('width', `${width}`);
    this.viewportClipPathRect.setAttribute('height', `${height}`);

    this.viewSettings.getAxis().updateOutputRange([
      this.viewSettings.spanBarViewportMargin,
      this.viewSettings.width - this.viewSettings.spanBarViewportMargin - this.sidebarWidth
    ]);

    _.forEach(this.groupViews, v => v.updateSeperatorLineWidths());
  }


  setupPanels() {
    const { width, height } = this.viewSettings;

    this.viewportClipPath.id = 'viewport-clip-path';
    this.viewportClipPathRect.setAttribute('x', `0`);
    this.viewportClipPathRect.setAttribute('y', `0`);
    this.viewportClipPathRect.setAttribute('width', `${width}`);
    this.viewportClipPathRect.setAttribute('height', `${height}`);
    this.viewportClipPath.appendChild(this.viewportClipPathRect);
    this.defs.appendChild(this.viewportClipPath);

    this.svg.appendChild(this.defs);

    this.viewportContainer.setAttribute('clip-path', 'url(#viewport-clip-path)');
    this.viewportContainer.appendChild(this.groupNamePanel);
    this.viewportContainer.appendChild(this.annotationUnderlayPanel);
    this.viewportContainer.appendChild(this.timelinePanel);
    this.viewportContainer.appendChild(this.annotationOverlayPanel);
    this.svg.appendChild(this.viewportContainer);
  }

  bindEvents() {
    this.svg.addEventListener('mousedown', this.binded.onMouseDown, false);
    this.svg.addEventListener('mousemove', this.binded.onMouseMove, false);
    this.svg.addEventListener('mouseup', this.binded.onMouseUp, false);
    this.svg.addEventListener('mouseleave', this.binded.onMouseLeave, false);
    this.svg.addEventListener('wheel', this.binded.onWheel, false);
  }

  onMouseDown(e: MouseEvent) {
    this.isMouseDown = true;
  }

  onMouseMove(e: MouseEvent) {
    // Update the cursor line
    this.cursorLine.setAttribute('transform', `translate(${e.offsetX}, 0)`);

    this.handlePanning(e);
  }

  handlePanning(e: MouseEvent) {
    if (!this.isMouseDown) return;

    const { height: viewportHeight } = this.viewSettings;
    if (this.contentHeight <= viewportHeight) {
      // No vertical panning
    } else {
      const newTranslateY = this.panelTranslateY + e.movementY;
      this.panelTranslateY = Math.min(Math.max(newTranslateY, viewportHeight - this.contentHeight), 0);
    }

    this.viewSettings.getAxis().translate(e.movementX);

    this.groupNamePanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.timelinePanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.annotationUnderlayPanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.annotationOverlayPanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
  }

  onMouseUp(e: MouseEvent) {
    this.isMouseDown = false;
  }

  onMouseLeave(e: MouseEvent) {
    this.isMouseDown = false;
  }

  onWheel(e: WheelEvent) {
    if (!this.stage) return;

    this.viewSettings.getAxis().zoom(
      1 - (this.viewSettings.scrollToZoomFactor * e.deltaY),
      e.offsetX
    );
  }

  unbindEvents() {
    this.svg.removeEventListener('mousedown', this.binded.onMouseDown, false);
    this.svg.removeEventListener('mousemove', this.binded.onMouseMove, false);
    this.svg.removeEventListener('mouseup', this.binded.onMouseUp, false);
    this.svg.removeEventListener('mouseleave', this.binded.onMouseLeave, false);
    this.svg.removeEventListener('wheel', this.binded.onWheel, false);
  }

  updateData(stage: Stage) {
    this.stage = stage;
    const grouping = stage.grouping[this.viewSettings.grouping];

    const { startTimestamp, finishTimestamp } = stage.group;
    this.viewSettings.setAxis(new Axis(
      [startTimestamp, finishTimestamp],
      [
        this.viewSettings.spanBarViewportMargin,
        this.viewSettings.width - this.viewSettings.spanBarViewportMargin - this.sidebarWidth
      ]
    ));

    _.forEach(this.groupViews, v => v.dispose()); // This will unbind all handlers, no need to manually remove listener
    this.groupViews = {};

    const groups = grouping.getAllGroups();
    groups.forEach((group) => {
      const groupView = new GroupView({ group, viewSettings: this.viewSettings });
      groupView.init({
        groupNamePanel: this.groupNamePanel,
        timelinePanel: this.timelinePanel,
        svgDefs: this.defs
      });
      groupView.layout();

      // Bind layout event after initial layout
      groupView.on(GroupViewEvent.LAYOUT, this.onGroupLayout.bind(this));
      groupView.on(GroupViewEvent.SPAN_CLICKED, this.onSpanClicked.bind(this));

      this.groupViews[group.id] = groupView;
    });

    this.updateGroupPositions();

    // Annotations
    this.annotation.updateData(Object.values(this.groupViews));

    // Reset vertical panning
    this.panelTranslateY = 0;
    this.groupNamePanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.timelinePanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.annotationUnderlayPanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.annotationOverlayPanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);

    // Show & hide cursor line
    this.cursorLine.style.display = groups.length > 0 ? '' : 'none';
  }

  onGroupLayout() {
    this.updateGroupPositions();
  }

  onSpanClicked(spanView: SpanView) {
    this.emit(TimelineViewEvent.SPAN_SELECTED, spanView);
  }

  updateGroupPositions() {
    const { groupPaddingTop, groupPaddingBottom, rowHeight } = this.viewSettings;
    let y = 0;

    _.forEach(this.groupViews, (groupView, i) => {
      groupView.updatePosition({ y });
      if (groupView.options.isCollapsed) {
        y += groupPaddingTop;
      } else {
        y += groupPaddingTop + groupPaddingBottom + (groupView.heightInRows * rowHeight);
      }
    });

    this.contentHeight = y;
  }

  getContentHeight() {
    return this.contentHeight;
  }

  updateSidebarWidth(width: number) {
    this.sidebarWidth = width;
    this.viewSettings.getAxis().updateOutputRange([
      this.viewSettings.spanBarViewportMargin,
      this.viewSettings.width - this.viewSettings.spanBarViewportMargin - this.sidebarWidth
    ]);
  }
}
