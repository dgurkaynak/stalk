import * as _ from 'lodash';
import React from 'react';
import { PageHeader, Icon, Layout, Tabs, Select, Divider, Badge, Empty, Collapse, Button } from 'antd';
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
const { TabPane } = Tabs;
const { Option } = Select;
const { Panel } = Collapse;


export interface TimelineScreenProps {
  visible: boolean
}

const SIDEBAR_WIDTH = 320;
const SIDEBAR_RESIZE_HANDLE_WIDTH = 6;

export class TimelineScreen extends React.Component<TimelineScreenProps> {
  private stage = Stage.getSingleton();
  private timelineContainerRef = React.createRef();
  private timelineView = new TimelineView();

  state = {
    stageTraces: this.stage.getAll(),
    groupingMode: ProcessGrouping.KEY, // Do not forget to change default value of TimelineViewSettings
    isSidebarVisible: false,
    sidebarSelectedTab: 'general',
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
    onGroupingModeChange: this.onGroupingModeChange.bind(this),
    onWindowResize: _.throttle(this.onWindowResize.bind(this), 500),
    handleSpanSelect: this.handleSpanSelect.bind(this),
    onTabChange: this.onTabChange.bind(this),
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
  };


  componentDidMount() {
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    window.addEventListener('resize', this.binded.onWindowResize, false);

    const containerEl = this.timelineContainerRef.current as HTMLDivElement;
    const { innerWidth, innerHeight } = window;
    this.timelineView.init(containerEl, {
      width: innerWidth - 80,
      height: innerHeight - 80
    });
    this.timelineView.on(TimelineViewEvent.SPAN_SELECTED, this.binded.handleSpanSelect);
    this.timelineView.on(TimelineViewEvent.LOG_CLICKED, this.binded.handleLogClick);
    this.timelineView.on(TimelineViewEvent.HOVER_CHANGED, this.binded.handleHoverChange);
  }


  onWindowResize() {
    const { innerWidth, innerHeight } = window;
    this.timelineView.resize(innerWidth - 80, innerHeight - 80);
  }


  componentWillUnmount() {
    this.stage.removeListener(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.removeListener(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    window.removeEventListener('resize', this.binded.onWindowResize, false);
    this.timelineView.removeListener(TimelineViewEvent.SPAN_SELECTED, [this.binded.handleSpanSelect] as any);
  }


  onStageTraceAdded(trace: Trace) {
    this.setState({
      stageTraces: this.stage.getAll(),
      sidebarSelectedTab: 'general',
      selectedSpanView: null,
      expandedLogIds: [] as string[],
      highlightedLogId: '',
    });
    this.timelineView.addTrace(trace);
  }

  onStageTraceRemoved(trace: Trace) {
    this.setState({
      stageTraces: this.stage.getAll(),
      sidebarSelectedTab: 'general',
      selectedSpanView: null,
      expandedLogIds: [] as string[],
      highlightedLogId: '',
    });
    this.timelineView.removeTrace(trace);
  }


  onGroupingModeChange(value: string) {
    this.timelineView.viewSettings.setGroupingKey(value);
    this.setState({ groupingMode: value });
  }

  toggleSidebarVisibility(isVisible: boolean) {
    this.setState({ isSidebarVisible: isVisible });
    this.timelineView.updateSidebarWidth(isVisible ? this.state.sidebarWidth : 0);
  }

  onTabChange(activeKey: string) {
    this.setState({ sidebarSelectedTab: activeKey });
  }

  handleSpanSelect(spanView: SpanView) {
    this.setState({
      isSidebarVisible: true,
      sidebarSelectedTab: spanView ? 'span-info' : 'general',
      selectedSpanView: spanView
    });
  }

  handleLogClick(data: { spanId: string, logId: string }) {
    const selectedSpanView = this.state.selectedSpanView! as SpanView;
    if (!selectedSpanView) return;
    if (selectedSpanView.span.id !== data.spanId) return;
    if (this.state.expandedLogIds.indexOf(data.logId) > -1) return;
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
      this.setState({ isSidebarResizing: false });
      return;
    }

    this.setState({ isSidebarResizing: true });
  }

  onMouseMove(e: MouseEvent) {
    if (!this.state.isSidebarResizing) return;
    this.setState({
      sidebarResizeHandleTranslateX: e.clientX - window.innerWidth + (SIDEBAR_RESIZE_HANDLE_WIDTH / 2)
    });
  }

  onMouseUp(e: MouseEvent) {
    // Apply!
    const sidebarWidth = -this.state.sidebarResizeHandleTranslateX + (SIDEBAR_RESIZE_HANDLE_WIDTH / 2);
    this.setState({ isSidebarResizing: false, sidebarWidth });
    this.timelineView.updateSidebarWidth(sidebarWidth);
  }

  onMouseLeave(e: MouseEvent) {
    // Reset the position
    this.setState({
      isSidebarResizing: false,
      sidebarResizeHandleTranslateX: -this.state.sidebarWidth + (SIDEBAR_RESIZE_HANDLE_WIDTH / 2)
    });
  }

  onExpandAllLogsButtonClick() {
    const spanLogViews = this.state.selectedSpanView ? (this.state.selectedSpanView! as SpanView).getLogViews() : [];
    this.setState({ expandedLogIds: spanLogViews.map(v => v.id) });
  }

  render() {
    const span: Span = this.state.selectedSpanView ? (this.state.selectedSpanView as any).span : {};
    const spanLogViews = this.state.selectedSpanView ? (this.state.selectedSpanView! as SpanView).getLogViews() : [];

    return (
      <div
        style={{ display: this.props.visible ? 'block' : 'none', overflow: 'auto', height: '100vh' }}
        onMouseDown={this.binded.onMouseDown as any}
        onMouseMove={this.binded.onMouseMove as any}
        onMouseUp={this.binded.onMouseUp as any}
        onMouseLeave={this.binded.onMouseLeave as any}
      >
        <Layout style={{ height: '100%', overflow: 'hidden' }}>
          <Content style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <PageHeader
              className="pageheader-with-button"
              backIcon={false}
              title="Timeline"
              style={{ background: '#fff' }}
              extra={[
                <Icon
                  key="0"
                  className="timeline-sidebar-toggle"
                  type={this.state.isSidebarVisible ? 'menu-unfold' : 'menu-fold'}
                  onClick={() => this.toggleSidebarVisibility(!this.state.isSidebarVisible)}
                />
              ]}
            ></PageHeader>

            <div
              id="timeline-container"
              ref={this.timelineContainerRef as any}
              style={{ flexGrow: 1 }}
            ></div>
          </Content>

          <Sider
            trigger={null}
            collapsible
            collapsedWidth={0}
            collapsed={!this.state.isSidebarVisible}
            className="timeline-sidebar"
            width={this.state.sidebarWidth}
            theme="light"
          >
            <Tabs activeKey={this.state.sidebarSelectedTab} onChange={this.binded.onTabChange}>


              {/* ==============================
                * ======== GENERAL TAB =========
                * ============================== */}
              <TabPane tab="General" key="general">
                <div style={{ margin: '0 10px 10px 10px' }}>
                  <h4>View Settings</h4>
                  <div className="sidebar-row">
                    <span>Group by:</span>
                    <Select
                      style={{ width: 120 }}
                      defaultValue={this.state.groupingMode}
                      onChange={this.binded.onGroupingModeChange}
                      size="small"
                      dropdownRender={menu => (
                        <div>
                          {menu}
                          <Divider style={{ margin: '4px 0' }} />
                          <div
                            style={{ padding: '4px 8px', marginBottom: 5, cursor: 'pointer' }}
                            onMouseDown={e => e.preventDefault()}
                          >
                            <Icon type="plus" /> Add grouping
                          </div>
                        </div>
                      )}
                    >
                      <Option key={TraceGrouping.KEY}>Trace</Option>
                      <Option key={ProcessGrouping.KEY}>Process</Option>
                      <Option key={ServiceNameGrouping.KEY}>Service Name</Option>
                    </Select>
                  </div>
                  <div className="sidebar-row">
                    <span>Span coloring:</span>
                    <Select defaultValue="operation-name" style={{ width: 120 }} disabled size="small">
                      <Option value="operation-name">Operation name</Option>
                      <Option value="process">Process</Option>
                      <Option value="service-name">Service Name</Option>
                    </Select>
                  </div>
                  <div className="sidebar-row">
                    <span>Span text:</span>
                    <Select defaultValue="operation-name" style={{ width: 120 }} disabled size="small">
                      <Option value="operation-name">Operation name</Option>
                    </Select>
                  </div>

                  <Divider style={{ margin: '10px 0' }} />

                  {this.state.stageTraces.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No trace added to timeline" />
                  ) : (
                    <h4>Traces</h4>
                  )}
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
              </TabPane>

              {/* ==============================
                * ======= SPAN INFO TAB ========
                * ============================== */}
              <TabPane tab="Span Info" key="span-info" disabled={!this.state.selectedSpanView}>
                {this.state.selectedSpanView ? (
                  <div className="span-info" style={{ margin: '0 10px 10px 10px' }}>
                    <h4>Info</h4>

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
                          const spanView = this.timelineView.annotation.findSpanView(ref.spanId)[1];
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
              </TabPane>

            </Tabs>
          </Sider>

          <div
            id="timeline-sidebar-resize-handle"
            style={{
              display: this.state.isSidebarVisible ? 'block' : 'none',
              opacity: this.state.isSidebarResizing ? 1 : 0,
              transform: `translate3d(${this.state.sidebarResizeHandleTranslateX}px, 0, 0)`
            }}
          >
            <div></div>
          </div>

      </Layout>

      </div>
    );
  }
}


export default TimelineScreen;
