import * as _ from 'lodash';
import React from 'react';
import { Icon, Layout, Divider, Badge, Empty, Collapse, Button, Tooltip, Menu, Dropdown } from 'antd';
import { Stage, StageEvent } from '../../model/stage';
import ColorManagers from '../color/managers';
import TimelineView, { TimelineViewEvent } from './view';
import prettyMilliseconds from 'pretty-ms';
import scroll from 'scroll';
import SpanView from './span-view';
import { Span } from '../../model/span';
import ProcessGrouping from '../../model/grouping/process';
import ServiceNameGrouping from '../../model/grouping/service-name';
import TraceGrouping from '../../model/grouping/trace';


import './timeline.css';
import { Trace } from '../../model/trace';
const { Sider, Content } = Layout;
const { Panel } = Collapse;


export interface TimelineScreenProps {
  visible: boolean
}

const SIDEBAR_WIDTH = 320;
const SIDEBAR_RESIZE_HANDLE_WIDTH = 6;
const LEFT_MENU_WIDTH = 80;
const HEADER_MENU_HEIGHT = 64;

export class TimelineScreen extends React.Component<TimelineScreenProps> {
  private stage = Stage.getSingleton();
  private containerRef = React.createRef();
  private timelineContainerRef = React.createRef();
  private timelineView = new TimelineView();

  state = {
    stageTraces: this.stage.getAll(),
    groupingMode: ProcessGrouping.KEY, // Do not forget to change default value of TimelineViewSettings
    selectedSpanView: null,
    expandedLogIds: [] as string[],
    highlightedLogId: '',
    sidebarWidth: SIDEBAR_WIDTH,
    sidebarResizeHandleTranslateX: -SIDEBAR_WIDTH + (SIDEBAR_RESIZE_HANDLE_WIDTH / 2),
    isSidebarResizing: false
  };
  binded = {
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    resizeTimelineViewAccordingToSidebar: _.throttle(this.resizeTimelineViewAccordingToSidebar.bind(this), 500),
    handleSpanSelect: this.handleSpanSelect.bind(this),
    handleSpanDeselect: this.handleSpanDeselect.bind(this),
    onLogsContainerMouseMove: this.onLogsContainerMouseMove.bind(this),
    onLogsContainerMouseLeave: this.onLogsContainerMouseLeave.bind(this),
    onLogsCollapseChange: this.onLogsCollapseChange.bind(this),
    handleLogClick: this.handleLogClick.bind(this),
    handleHoverChange: this.handleHoverChange.bind(this),
    onMouseDown: this.onMouseDown.bind(this),
    onMouseMove: this.onMouseMove.bind(this),
    onMouseUp: this.onMouseUp.bind(this),
    onMouseLeave: this.onMouseLeave.bind(this),
    onExpandAllLogsButtonClick: this.onExpandAllLogsButtonClick.bind(this),
    onGroupingModeMenuClick: this.onGroupingModeMenuClick.bind(this),
  };

  componentDidMount() {
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    window.addEventListener('resize', this.binded.resizeTimelineViewAccordingToSidebar, false);

    const containerEl = this.timelineContainerRef.current as HTMLDivElement;
    const { innerWidth, innerHeight } = window;
    this.timelineView.init(containerEl, {
      width: innerWidth - LEFT_MENU_WIDTH,
      height: innerHeight - HEADER_MENU_HEIGHT
    });
    this.timelineView.on(TimelineViewEvent.SPAN_SELECTED, this.binded.handleSpanSelect);
    this.timelineView.on(TimelineViewEvent.SPAN_DESELECTED, this.binded.handleSpanDeselect);
    this.timelineView.on(TimelineViewEvent.LOG_CLICKED, this.binded.handleLogClick);
    this.timelineView.on(TimelineViewEvent.HOVER_CHANGED, this.binded.handleHoverChange);
  }

  componentWillUnmount() {
    this.stage.removeListener(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.removeListener(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    window.removeEventListener('resize', this.binded.resizeTimelineViewAccordingToSidebar, false);
    this.timelineView.removeListener(TimelineViewEvent.SPAN_SELECTED, [this.binded.handleSpanSelect] as any);
    this.timelineView.removeListener(TimelineViewEvent.SPAN_DESELECTED, [this.binded.handleSpanDeselect] as any);
  }

  onStageTraceAdded(trace: Trace) {
    this.setState({
      stageTraces: this.stage.getAll(),
      selectedSpanView: null,
      expandedLogIds: [] as string[],
      highlightedLogId: '',
    }, () => {
      this.resizeTimelineViewAccordingToSidebar();
    });
    this.timelineView.addTrace(trace);
  }

  onStageTraceRemoved(trace: Trace) {
    this.setState({
      stageTraces: this.stage.getAll(),
      selectedSpanView: null,
      expandedLogIds: [] as string[],
      highlightedLogId: '',
    }, () => {
      this.resizeTimelineViewAccordingToSidebar();
    });
    this.timelineView.removeTrace(trace);
  }

  resizeTimelineViewAccordingToSidebar() {
    const { innerWidth, innerHeight } = window;
    this.timelineView.resize(
      innerWidth - LEFT_MENU_WIDTH - (this.state.selectedSpanView ? this.state.sidebarWidth : 0),
      innerHeight - HEADER_MENU_HEIGHT
    );
  }

  handleSpanSelect(spanView: SpanView) {
    this.setState({ selectedSpanView: spanView }, () => {
      this.resizeTimelineViewAccordingToSidebar();
    });
  }

  handleSpanDeselect() {
    this.setState({ selectedSpanView: null }, () => {
      this.resizeTimelineViewAccordingToSidebar();
    });
  }

  handleLogClick(data: { spanId: string, logId: string }) {
    const selectedSpanView = this.state.selectedSpanView! as SpanView;
    if (!selectedSpanView) return;
    if (selectedSpanView.span.id !== data.spanId) return;
    if (this.state.expandedLogIds.indexOf(data.logId) > -1) {
      this.highlightAndScrollToLog(data.logId);
      return;
    }

    this.setState({ expandedLogIds: [ ...this.state.expandedLogIds, data.logId ] }, () => {
      setTimeout(() => this.highlightAndScrollToLog(data.logId), 250);
    });
  }

  handleHoverChange(data: {
    added: { type: string, element: Element }[],
    removed: { type: string, element: Element }[]
  }) {
    const selectedSpanView = this.state.selectedSpanView! as SpanView;
    if (!selectedSpanView) return;

    this.setState({ highlightedLogId: '' });

    data.added.forEach(({ type, element }) => {
      if (type !== SpanView.ViewType.LOG_CIRCLE) return;
      const spanId = element.getAttribute('data-span-id');
      const logId = element.getAttribute('data-log-id');
      if (!spanId || !logId) return;
      if (spanId !== selectedSpanView.span.id) return;
      this.highlightAndScrollToLog(logId);
    });
  }

  onLogsContainerMouseMove(e: MouseEvent) {
    const selectedSpanView = this.state.selectedSpanView! as SpanView;
    if (!selectedSpanView) return;

    const element = e.target as Element;
    const logContainerElement = element.closest(`div[id^='log-panel']`);
    if (!logContainerElement) {
      return;
    }
    const logId = logContainerElement.id.replace('log-panel-', '');

    this.timelineView.annotation.logHighlightAnnotation.prepare({ spanView: selectedSpanView, logId });
    this.timelineView.annotation.logHighlightAnnotation.mount();
    this.timelineView.annotation.logHighlightAnnotation.update();
  }

  onLogsContainerMouseLeave(e: MouseEvent) {
    this.timelineView.annotation.logHighlightAnnotation.unmount();
  }

  onLogsCollapseChange(expandedLogIds: string[]) {
    this.setState({ expandedLogIds });
  }

  highlightAndScrollToLog(logId: string) {
    const logPanelEl = document.getElementById(`log-panel-${logId}`);
    if (!logPanelEl) return;
    const sidebarEl = document.getElementsByClassName('timeline-sidebar')[0];
    if (!sidebarEl) return;
    const { innerHeight } = window;
    const { offsetTop } = logPanelEl;
    const clientRect = logPanelEl.getBoundingClientRect();


    if (clientRect.top >= 0 && clientRect.bottom <= innerHeight) {
      // Log panel is completely visible, NOOP
    } else {
      scroll.top(sidebarEl, offsetTop);
    }

    this.setState({ highlightedLogId: logId });
  }

  onMouseDown(e: MouseEvent) {
    // Sidebar resize handle element contains just one child
    const targetEl = e.target as Element;
    const parentEl = targetEl.parentElement!;
    if ([targetEl.id, parentEl.id].indexOf('timeline-sidebar-resize-handle') === -1) {
      if (!this.state.isSidebarResizing) return;
      this.setState({ isSidebarResizing: false });
      this.unbindSidebarResizingEvents();
      return;
    }

    this.bindSidebarResizingEvents();
    this.setState({ isSidebarResizing: true });
  }

  bindSidebarResizingEvents() {
    const el = this.containerRef.current as HTMLDivElement;
    el.addEventListener('mousemove', this.binded.onMouseMove, false);
    el.addEventListener('mouseup', this.binded.onMouseUp, false);
  }

  unbindSidebarResizingEvents() {
    const el = this.containerRef.current as HTMLDivElement;
    el.removeEventListener('mousemove', this.binded.onMouseMove, false);
    el.removeEventListener('mouseup', this.binded.onMouseUp, false);
  }

  onMouseMove(e: MouseEvent) {
    this.setState({
      sidebarResizeHandleTranslateX: e.clientX - window.innerWidth + (SIDEBAR_RESIZE_HANDLE_WIDTH / 2)
    });
  }

  onMouseUp(e: MouseEvent) {
    // Apply!
    const sidebarWidth = -this.state.sidebarResizeHandleTranslateX + (SIDEBAR_RESIZE_HANDLE_WIDTH / 2);
    this.setState({ isSidebarResizing: false, sidebarWidth }, () => {
      this.resizeTimelineViewAccordingToSidebar();
    });
    this.unbindSidebarResizingEvents();
  }

  onMouseLeave(e: MouseEvent) {
    // Reset the position
    this.setState({
      isSidebarResizing: false,
      sidebarResizeHandleTranslateX: -this.state.sidebarWidth + (SIDEBAR_RESIZE_HANDLE_WIDTH / 2)
    });
    this.unbindSidebarResizingEvents();
  }

  onExpandAllLogsButtonClick() {
    const spanLogViews = this.state.selectedSpanView ? (this.state.selectedSpanView! as SpanView).getLogViews() : [];
    this.setState({ expandedLogIds: spanLogViews.map(v => v.id) });
  }

  onGroupingModeMenuClick(data: any) {
    if (data.key === 'add-grouping') {
      // TODO: Open modal to add/test grouping
      return;
    }

    this.timelineView.viewSettings.setGroupingKey(data.key);
    this.setState({ groupingMode: data.key });
  }

  render() {
    const span: Span = this.state.selectedSpanView ? (this.state.selectedSpanView as any).span : {};
    const spanLogViews = this.state.selectedSpanView ? (this.state.selectedSpanView! as SpanView).getLogViews() : [];

    return (
      <div
        style={{ display: this.props.visible ? 'block' : 'none', overflow: 'auto', height: '100vh' }}
        ref={this.containerRef as any}
        onMouseDown={this.binded.onMouseDown as any}
        onMouseLeave={this.binded.onMouseLeave as any}
      >
        <Layout style={{ height: '100%', overflow: 'hidden' }}>
          <Content style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="timeline-screen-header">
              <div className="left">

                <Dropdown overlay={
                  <Menu
                    selectedKeys={[ this.state.groupingMode ]}
                    onClick={this.binded.onGroupingModeMenuClick}
                    style={{ marginLeft: 5 }}
                  >
                    <Menu.Item key={TraceGrouping.KEY}>
                      Trace
                    </Menu.Item>
                    <Menu.Item key={ProcessGrouping.KEY}>
                      Process
                    </Menu.Item>
                    <Menu.Item key={ServiceNameGrouping.KEY}>
                      Service Name
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item key="add-grouping">
                      <Icon type="plus" /> Create new
                    </Menu.Item>
                  </Menu>
                } trigger={['click']}>
                  <Tooltip placement="right" title="Grouping Mode" mouseEnterDelay={1}>
                    <span className="timeline-header-button">
                      <Icon type="team" />
                    </span>
                  </Tooltip>
                </Dropdown>

                <Dropdown overlay={
                  <Menu>
                    <Menu.Item key="operation">Operation Name</Menu.Item>
                    <Menu.Item key="service-operation">Service + Operation Name</Menu.Item>
                    <Menu.Divider />
                    <Menu.Item key="add-grouping">
                      <Icon type="plus" /> Create new
                    </Menu.Item>
                  </Menu>
                } trigger={['click']}>
                  <Tooltip placement="right" title="Span Labelling" mouseEnterDelay={1}>
                    <span className="timeline-header-button">
                      <Icon type="edit" />
                    </span>
                  </Tooltip>
                </Dropdown>

                <Dropdown overlay={
                  <Menu>
                    <Menu.Item key="service-name">Service Name</Menu.Item>
                    <Menu.Item key="operation-name">Operation Name</Menu.Item>
                    <Menu.Item key="label">Label</Menu.Item>
                    <Menu.Divider />
                    <Menu.Item key="add-grouping">
                      <Icon type="plus" /> Create new
                    </Menu.Item>
                  </Menu>
                } trigger={['click']}>
                  <Tooltip placement="right" title="Span Coloring" mouseEnterDelay={1}>
                    <span className="timeline-header-button">
                      <Icon type="highlight" />
                    </span>
                  </Tooltip>
                </Dropdown>

              </div>
              <div className="right">
                <Dropdown overlay={
                  <div style={{ background: '#fff', width: 300, marginRight: 5, overflowY: 'auto', borderRadius: 4, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' }}>
                    {this.state.stageTraces.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No trace added to stage" />
                    ) : null}

                    {this.state.stageTraces.map((trace, i) => (
                      <div className="sidebar-row" key={i}>
                        <span>
                          <Badge
                            color={ColorManagers.traceName.colorFor(trace.id) as string}
                            className="search-result-item-badge"
                          />
                          {trace.name}
                        </span>
                        <Icon
                          type="close"
                          onClick={() => this.stage.remove(trace.id)}
                        />
                      </div>
                    ))}
                  </div>
                } trigger={['click']}>
                  <Tooltip placement="left" title="Trace List" mouseEnterDelay={1}>
                    <span className="timeline-header-button">
                      <Badge count={this.state.stageTraces.length}>
                        <Icon type="branches" />
                      </Badge>
                    </span>
                  </Tooltip>
                </Dropdown>
              </div>
            </div>

            <div style={{ display: 'flex', maxHeight: 'calc(100% - 64px)' }} >

              {/* Timeline view container */}
              <div
                id="timeline-container"
                ref={this.timelineContainerRef as any}
              ></div>

              {/* Span info sidebar */}
              <Sider
                trigger={null}
                collapsible
                collapsedWidth={0}
                collapsed={!this.state.selectedSpanView}
                className="timeline-sidebar"
                width={this.state.sidebarWidth}
                theme="light"
              >

                  {this.state.selectedSpanView ? (
                    <div style={{ margin: 10 }}>
                      <h4>Span Info</h4>

                      <div className="sidebar-row">
                        <span>Operation name:</span>
                        <span style={{fontWeight: 'bold'}}>{span.operationName}</span>
                      </div>
                      <div className="sidebar-row">
                        <span>Service name:</span>
                        <span style={{fontWeight: 'bold'}}>{span.process ? span.process.serviceName :
                          span.localEndpoint ? span.localEndpoint.serviceName :
                          'Unknown'
                        }</span>
                      </div>
                      <div className="sidebar-row">
                        <span>Duration:</span>
                        <span style={{fontWeight: 'bold'}}>
                          {prettyMilliseconds((span.finishTime - span.startTime) / 1000, { formatSubMilliseconds: true })}
                        </span>
                      </div>
                      {span.references.map((ref) => (
                        <div className="sidebar-row" key={ref.type}>
                          <span>{ref.type === 'childOf' ? 'Child of:' :
                              ref.type === 'followsFrom' ? 'Follows from:' :
                              ref.type}</span>
                          <span>{(() => {
                            const spanView = this.timelineView.findSpanView(ref.spanId)[1];
                            if (!spanView) return ref.spanId;
                            return spanView.span.operationName; // TODO: Use viewSettings.spanLabeling func
                          })()}</span>
                        </div>
                      ))}

                      <Divider style={{ margin: '10px 0' }} />

                      <h4>Tags</h4>

                      {Object.keys(span.tags).length > 0 ? _.map(span.tags, (value, tag) => (
                        <div className="sidebar-row mono even-odd" key={tag}>
                          <span>{tag}:</span>
                          <span>{value}</span>
                        </div>
                      )) : (
                        <span>No tags</span>
                      )}

                      <Divider style={{ margin: '10px 0' }} />

                      <div className="sidebar-row">
                        <h4>Logs</h4>
                        {spanLogViews.length > 0 ? (
                          <Button
                            type="link"
                            size="small"
                            style={{ marginBottom: 7 }}
                            onClick={this.binded.onExpandAllLogsButtonClick}
                          >Expand All</Button>
                        ) : null}

                      </div>

                      {spanLogViews.length === 0 ? (
                        <span>No logs</span>
                      ) : (
                        <div
                          onMouseMove={this.binded.onLogsContainerMouseMove as any}
                          onMouseLeave={this.binded.onLogsContainerMouseLeave as any}
                        >
                          <Collapse activeKey={this.state.expandedLogIds} onChange={this.binded.onLogsCollapseChange as any}>
                            {_.map(spanLogViews, (logView) => (
                              <Panel
                                header={`Log @ ${prettyMilliseconds((logView.log.timestamp - span.startTime) / 1000, { formatSubMilliseconds: true })}`}
                                key={logView.id}
                                id={`log-panel-${logView.id}`}
                                className={logView.id === this.state.highlightedLogId ? 'sidebar-log-panel-higlighted' : ''}
                              >
                                {_.map(logView.log.fields, (value, name) => (
                                  <div className="sidebar-row mono" key={name}>
                                    <span>{name}:</span>
                                    <span>{value}</span>
                                  </div>
                                ))}
                              </Panel>
                            ))}
                          </Collapse>
                        </div>
                      )}

                    </div>
                  ) : null}

              </Sider>

              {/* Sidebar resize handle */}
              <div
                id="timeline-sidebar-resize-handle"
                style={{
                  display: this.state.selectedSpanView ? 'block' : 'none',
                  opacity: this.state.isSidebarResizing ? 1 : 0,
                  transform: `translate3d(${this.state.sidebarResizeHandleTranslateX}px, 0, 0)`
                }}
              >
                <div></div>
              </div>

            </div>

          </Content>

      </Layout>

      </div>
    );
  }
}


export default TimelineScreen;
