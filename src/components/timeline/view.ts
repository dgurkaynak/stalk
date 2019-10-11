import * as _ from 'lodash';
import { Stage } from '../../model/stage';
import GroupView from './group-view';
import Axis from './axis';
import ViewSettings from './view-settings';

const SVG_NS = 'http://www.w3.org/2000/svg';


export default class TimelineView {
  svg = document.createElementNS(SVG_NS, 'svg');

  private defs = document.createElementNS(SVG_NS, 'defs');
  private groupNamePanelClipPath = document.createElementNS(SVG_NS, 'clipPath');
  private groupNamePanelClipPathRect = document.createElementNS(SVG_NS, 'rect');
  private timelinePanelClipPath = document.createElementNS(SVG_NS, 'clipPath');
  private timelinePanelClipPathRect = document.createElementNS(SVG_NS, 'rect');

  private groupNamePanelContainer = document.createElementNS(SVG_NS, 'g');
  private groupNamePanel = document.createElementNS(SVG_NS, 'g');
  private timelinePanelContainer = document.createElementNS(SVG_NS, 'g');
  private timelinePanel = document.createElementNS(SVG_NS, 'g');
  private panelTranslateY = 0;

  private isMouseDown = false;

  private stage?: Stage;
  private viewSettings = new ViewSettings();
  private groupViews: { [key: string]: GroupView} = {};

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
    if (options && options.viewSettings) this.viewSettings = options.viewSettings;
    this.svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
    this.svg.classList.add('timeline-svg');
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

    this.groupNamePanelClipPathRect.setAttribute('width', `${width}`);
    this.groupNamePanelClipPathRect.setAttribute('height', `${height}`);

    this.timelinePanelClipPathRect.setAttribute('width', `${width}`);
    this.timelinePanelClipPathRect.setAttribute('height', `${height}`);

    _.forEach(this.groupViews, v => v.updateSeperatorLineWidths());
  }


  setupPanels() {
    const { width, height } = this.viewSettings;
    this.groupNamePanelClipPath.id = 'group-name-panel-clip-path';
    this.groupNamePanelClipPathRect.setAttribute('x', `0`);
    this.groupNamePanelClipPathRect.setAttribute('y', `0`);
    this.groupNamePanelClipPathRect.setAttribute('width', `${width}`);
    this.groupNamePanelClipPathRect.setAttribute('height', `${height}`);
    this.groupNamePanelClipPath.appendChild(this.groupNamePanelClipPathRect);
    this.defs.appendChild(this.groupNamePanelClipPath);

    this.timelinePanelClipPath.id = 'timeline-panel-clip-path';
    this.timelinePanelClipPathRect.setAttribute('x', `0`);
    this.timelinePanelClipPathRect.setAttribute('y', `0`);
    this.timelinePanelClipPathRect.setAttribute('width', `${width}`);
    this.timelinePanelClipPathRect.setAttribute('height', `${height}`);
    this.timelinePanelClipPath.appendChild(this.timelinePanelClipPathRect);
    this.defs.appendChild(this.timelinePanelClipPath);

    this.svg.appendChild(this.defs);

    this.groupNamePanelContainer.setAttribute('clip-path', 'url(#group-name-panel-clip-path)');
    this.groupNamePanelContainer.appendChild(this.groupNamePanel);
    this.svg.appendChild(this.groupNamePanelContainer);

    this.timelinePanelContainer.setAttribute('clip-path', 'url(#timeline-panel-clip-path)');
    this.timelinePanelContainer.appendChild(this.timelinePanel);
    this.svg.appendChild(this.timelinePanelContainer);
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
    if (!this.isMouseDown) return;

    this.panelTranslateY += e.movementY;
    this.viewSettings.axis.translate(e.movementX);
    _.forEach(this.groupViews, v => v.updateVisibleSpanPositions());

    this.groupNamePanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
    this.timelinePanel.setAttribute('transform', `translate(0, ${this.panelTranslateY})`);
  }

  onMouseUp(e: MouseEvent) {
    this.isMouseDown = false;
  }

  onMouseLeave(e: MouseEvent) {
    this.isMouseDown = false;
  }

  onWheel(e: WheelEvent) {
    if (!this.stage) return;

    this.viewSettings.axis.zoom(
      1 - (this.viewSettings.scrollToZoomFactor * e.deltaY),
      e.offsetX
    );
    _.forEach(this.groupViews, v => v.updateVisibleSpanPositions());
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
    this.viewSettings.axis = new Axis([startTimestamp, finishTimestamp], [0, this.viewSettings.width]);

    _.forEach(this.groupViews, v => v.dispose());
    this.groupViews = {};

    const groups = grouping.getAllGroups();
    groups.forEach((group) => {
      const groupView = new GroupView({ group, viewSettings: this.viewSettings });
      groupView.mount({
        groupNamePanel: this.groupNamePanel,
        timelinePanel: this.timelinePanel
      });
      groupView.setupSpans();

      this.groupViews[group.id] = groupView;
    });

    this.updateGroupPositions();
  }

  updateGroupPositions() {
    const { groupPaddingTop, groupPaddingBottom, barHeight, barSpacing } = this.viewSettings;
    let y = 0;

    _.forEach(this.groupViews, (groupView, i) => {
      groupView.updatePosition({ y });
      y += groupPaddingTop + groupPaddingBottom + groupView.height * (2 * barSpacing + barHeight);
    });
  }
}
