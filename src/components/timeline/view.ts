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
  private groupNamePanelTranslateY = 0;
  private timelinePanelContainer = document.createElementNS(SVG_NS, 'g');
  private timelinePanel = document.createElementNS(SVG_NS, 'g');
  private timelinePanelTranslateX = 0;
  private timelinePanelTranslateY = 0;

  private width = NaN;
  private height = NaN;

  private isMouseDown = false;

  private binded = {
    onMouseDown: this.onMouseDown.bind(this),
    onMouseMove: this.onMouseMove.bind(this),
    onMouseUp: this.onMouseUp.bind(this),
    onMouseLeave: this.onMouseLeave.bind(this)
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
  }

  onMouseDown(e: MouseEvent) {
    this.isMouseDown = true;
  }

  onMouseMove(e: MouseEvent) {
    if (!this.isMouseDown) return;

    this.groupNamePanelTranslateY += e.movementY;
    this.timelinePanelTranslateX += e.movementX;
    this.timelinePanelTranslateY += e.movementY;

    this.groupNamePanel.setAttribute('transform', `translate(0, ${this.groupNamePanelTranslateY})`);
    this.timelinePanel.setAttribute('transform', `translate(${this.timelinePanelTranslateX}, ${this.timelinePanelTranslateY})`);
  }

  onMouseUp(e: MouseEvent) {
    this.isMouseDown = false;
  }

  onMouseLeave(e: MouseEvent) {
    this.isMouseDown = false;
  }

  unbindEvents() {
    this.svg.removeEventListener('mousedown', this.binded.onMouseDown, false);
    this.svg.removeEventListener('mousemove', this.binded.onMouseMove, false);
    this.svg.removeEventListener('mouseup', this.binded.onMouseUp, false);
    this.svg.removeEventListener('mouseleave', this.binded.onMouseLeave, false);
  }


  draw() {
    const text = document.createElementNS(SVG_NS, 'text');
    text.textContent = 'TEST';
    text.setAttribute('x', '10');
    text.setAttribute('y', '20');
    this.groupNamePanel.appendChild(text);

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', `10`);
    rect.setAttribute('y', '10');
    rect.setAttribute('width', '100');
    rect.setAttribute('height', '10');
    rect.setAttribute('fill', '#000');
    this.timelinePanel.appendChild(rect);
  }
}
