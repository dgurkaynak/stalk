export default class TimelineView {
  element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private width = NaN;
  private height = NaN;


  constructor() {
    this.element.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }


  render(parentElement: HTMLElement, options?: {
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

    parentElement.appendChild(this.element);
  }


  resize(width: number, height: number) {
    this.element.setAttribute('width', `${width}`);
    this.element.setAttribute('height', `${height}`);
    this.element.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.width = width;
    this.height = height;
  }
}
