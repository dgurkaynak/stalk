import { Stage } from '../../model/stage';
import { Grouping } from '../../model/grouping/grouping';
import SpanView from './span-view';
import Axis from './axis';

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

  private width = NaN;
  private height = NaN;
  private get visibleWidth() { return this.svg.parentElement!.offsetWidth; }

  private isMouseDown = false;

  private stage?: Stage;
  private grouping?: Grouping;
  public axis?: Axis;
  private spanViews: SpanView[] = [];

  viewSettings = {
    singleDepthViewHeight: 50,
  };

  private binded = {
    onMouseDown: this.onMouseDown.bind(this),
    onMouseMove: this.onMouseMove.bind(this),
    onMouseUp: this.onMouseUp.bind(this),
    onMouseLeave: this.onMouseLeave.bind(this),
    onWheel: this.onWheel.bind(this),
  };


  constructor() {
    this.svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
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
    this.width = width;
    this.height = height;

    this.svg.setAttribute('width', `${width}`);
    this.svg.setAttribute('height', `${height}`);
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    this.groupNamePanelClipPathRect.setAttribute('width', `${this.width}`);
    this.groupNamePanelClipPathRect.setAttribute('height', `${this.height}`);

    this.timelinePanelClipPathRect.setAttribute('width', `${this.width}`);
    this.timelinePanelClipPathRect.setAttribute('height', `${this.height}`);
  }


  setupPanels() {
    this.groupNamePanelClipPath.id = 'group-name-panel-clip-path';
    this.groupNamePanelClipPathRect.setAttribute('x', `0`);
    this.groupNamePanelClipPathRect.setAttribute('y', `0`);
    this.groupNamePanelClipPathRect.setAttribute('width', `${this.width}`);
    this.groupNamePanelClipPathRect.setAttribute('height', `${this.height}`);
    this.groupNamePanelClipPath.appendChild(this.groupNamePanelClipPathRect);
    this.defs.appendChild(this.groupNamePanelClipPath);

    this.timelinePanelClipPath.id = 'timeline-panel-clip-path';
    this.timelinePanelClipPathRect.setAttribute('x', `0`);
    this.timelinePanelClipPathRect.setAttribute('y', `0`);
    this.timelinePanelClipPathRect.setAttribute('width', `${this.width}`);
    this.timelinePanelClipPathRect.setAttribute('height', `${this.height}`);
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
    this.axis!.translate(e.movementX);
    this.spanViews.forEach(spanView => spanView.updatePositionAndSize());

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

    this.axis!.zoom(1 - (e.deltaY * 0.025), e.offsetX);

    this.spanViews.forEach(spanView => spanView.updatePositionAndSize());
  }

  unbindEvents() {
    this.svg.removeEventListener('mousedown', this.binded.onMouseDown, false);
    this.svg.removeEventListener('mousemove', this.binded.onMouseMove, false);
    this.svg.removeEventListener('mouseup', this.binded.onMouseUp, false);
    this.svg.removeEventListener('mouseleave', this.binded.onMouseLeave, false);
    this.svg.removeEventListener('wheel', this.binded.onWheel, false);
  }

  updateData(stage: Stage, grouping: Grouping) {
    this.stage = stage;
    this.grouping = grouping;

    const { startTimestamp, finishTimestamp } = stage.group;
    this.axis = new Axis([startTimestamp, finishTimestamp], [0, this.width]);

    // TODO: Re-use spanviews!
    this.spanViews.forEach(v => v.unmount());
    this.spanViews = [];

    const groups = this.grouping.getAllGroups();
    groups.forEach((group) => {
      group.calculateDepthMap();

      group.getAll().forEach((span) => {
        const spanView = new SpanView(this);
        spanView.prepare(span);
        this.spanViews.push(spanView);
        spanView.mount(this.timelinePanel);
      });
    });
  }

  draw() {
    // this.spanViews.forEach(v => v.);
  }
}
