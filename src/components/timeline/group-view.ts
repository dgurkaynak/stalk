import { Group } from '../../model/grouping/group';
import SpanView from './span-view';
import LayoutManager from './layout-manager';
import ViewSettings from './view-settings';


const SVG_NS = 'http://www.w3.org/2000/svg';


export default class GroupView {
  group: Group;
  viewSettings: ViewSettings;
  spanViews: { [key: string]: SpanView} = {};
  g = document.createElementNS(SVG_NS, 'g');
  groupNameLine = document.createElementNS(SVG_NS, 'line');
  groupNameText = document.createElementNS(SVG_NS, 'text');
  layout = new LayoutManager(this);
  options = {
    isCollapsed: false
  };

  constructor(options: {
    group: Group,
    viewSettings: ViewSettings
  }) {
    this.group = options.group;
    this.viewSettings = options.viewSettings;

    this.groupNameLine.setAttribute('x1', '0');
    this.groupNameLine.setAttribute('x2', this.viewSettings.width + '');
    this.groupNameLine.setAttribute('y1', '0');
    this.groupNameLine.setAttribute('y2', '0');
    this.groupNameLine.setAttribute('stroke', this.viewSettings.groupSeperatorLineColor);
    this.groupNameLine.setAttribute('stroke-width', this.viewSettings.groupSeperatorLineWidth + '');

    this.groupNameText.textContent = this.group.name;
    this.groupNameText.setAttribute('fill', this.viewSettings.groupTextColor);
    this.groupNameText.setAttribute('x', '0');
    this.groupNameText.setAttribute('y', '0');
    this.groupNameText.setAttribute('font-size', `${this.viewSettings.groupTextFontSize}px`);
  }

  mount(options: {
    groupNamePanel: SVGGElement,
    timelinePanel: SVGGElement
  }) {
    options.timelinePanel.appendChild(this.g);
    options.groupNamePanel.appendChild(this.groupNameLine);
    options.groupNamePanel.appendChild(this.groupNameText);
  }

  dispose() {
    // Unmount self
    const parent1 = this.g.parentElement;
    parent1 && parent1.removeChild(this.g);
    const parent2 = this.groupNameLine.parentElement;
    parent2 && parent2.removeChild(this.groupNameLine);
    const parent3 = this.groupNameText.parentElement;
    parent3 && parent3.removeChild(this.groupNameText);

    // Unmount spans
    const spanViews = Object.values(this.spanViews);
    spanViews.forEach(v => v.unmount());
    this.spanViews = {};
    // TODO: Re-use spanviews!

    this.layout.reset();
  }

  setupSpans() {
    this.group.getAll().forEach((span) => {
        // TODO: Reuse spanviews
        const spanView = new SpanView({ viewSettings: this.viewSettings });
        spanView.reuse(span);
        this.spanViews[span.id] = spanView;
    });

    this.layout.trigger();
  }
}
