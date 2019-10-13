import * as _ from 'lodash';
import React from 'react';
import { PageHeader, Icon, Layout, Tabs, Select, Divider, Badge, Empty, Collapse } from 'antd';
import { Stage, StageEvent } from '../../model/stage';
import ColorManagers from '../color/managers';
import TimelineView, { TimelineViewEvent } from './view';
import prettyMilliseconds from 'pretty-ms';


import './timeline.css';
import SpanView from './span-view';
import { Span } from '../../model/span';
const { Sider, Content } = Layout;
const { TabPane } = Tabs;
const { Option } = Select;
const { Panel } = Collapse;


export interface TimelineScreenProps {
  visible: boolean
}


export class TimelineScreen extends React.Component<TimelineScreenProps> {
  private stage = Stage.getSingleton();
  private timelineContainerRef = React.createRef();
  private timelineView = new TimelineView();
  private sidebarWidth = 320;
  state = {
    traceGroups: this.stage.grouping.trace.getAllGroups(),
    groupingMode: 'trace',
    isSidebarVisible: false,
    sidebarSelectedTab: 'general',
    selectedSpanView: null
  };
  binded = {
    onStageUpdated: this.onStageUpdated.bind(this),
    onGroupingModeChange: this.onGroupingModeChange.bind(this),
    onWindowResize: _.throttle(this.onWindowResize.bind(this), 500),
    handleSpanSelect: this.handleSpanSelect.bind(this),
    onTabChange: this.onTabChange.bind(this),
  };


  componentDidMount() {
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageUpdated);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageUpdated);
    window.addEventListener('resize', this.binded.onWindowResize, false);

    const containerEl = this.timelineContainerRef.current as HTMLDivElement;
    const { innerWidth, innerHeight } = window;
    this.timelineView.init(containerEl, {
      width: innerWidth - 80,
      height: innerHeight - 80
    });
    this.timelineView.on(TimelineViewEvent.SPAN_SELECTED, this.binded.handleSpanSelect);
  }


  onWindowResize() {
    const { innerWidth, innerHeight } = window;
    this.timelineView.resize(innerWidth - 80, innerHeight - 80);
  }


  componentWillUnmount() {
    this.stage.removeListener(StageEvent.TRACE_ADDED, this.binded.onStageUpdated);
    this.stage.removeListener(StageEvent.TRACE_REMOVED, this.binded.onStageUpdated);
    window.removeEventListener('resize', this.binded.onWindowResize, false);
    this.timelineView.removeListener(TimelineViewEvent.SPAN_SELECTED, [this.binded.handleSpanSelect] as any);
  }


  onStageUpdated() {
    this.setState({ traceGroups: this.stage.grouping.trace.getAllGroups() });
    this.timelineView.updateData(this.stage);
  }


  onGroupingModeChange(value: string) {
    this.setState({ groupingMode: value });
  }

  toggleSidebarVisibility(isVisible: boolean) {
    this.setState({ isSidebarVisible: isVisible });
    this.timelineView.updateSidebarWidth(isVisible ? this.sidebarWidth : 0);
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
    console.log('span selected');
  }

  render() {
    const span: Span = this.state.selectedSpanView ? (this.state.selectedSpanView as any).span : {};
    const spanLogViews = this.state.selectedSpanView ? (this.state.selectedSpanView! as SpanView).getLogViews() : [];

    return (
      <div style={{ display: this.props.visible ? 'block' : 'none', overflow: 'auto', height: '100vh' }}>
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
            width={this.sidebarWidth}
            theme="light"
          >
            <Tabs activeKey={this.state.sidebarSelectedTab} onChange={this.binded.onTabChange}>
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
                      <Option key="trace">Trace</Option>
                      <Option key="process">Process</Option>
                      <Option key="service-name">Service Name</Option>
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

                  {this.state.traceGroups.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No trace added to timeline" />
                  ) : (
                    <h4>Traces</h4>
                  )}
                  {this.state.traceGroups.map((traceGroup, i) => (
                    <div className="sidebar-row" key={i}>
                      <span>
                        <Badge
                          color={ColorManagers.traceName.colorFor(traceGroup.id) as string}
                          className="search-result-item-badge"
                        />
                        {traceGroup.name}
                      </span>
                      <Icon
                        type="close"
                        onClick={() => this.stage.removeTrace(traceGroup.id)}
                      />
                    </div>
                  ))}
                </div>
              </TabPane>

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
                    <div className="sidebar-row">
                      <span>Span ID:</span>
                      <span>{span.id}</span>
                    </div>

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

                    <h4>Logs</h4>

                    {spanLogViews.length == 0 ? (
                      <span>No logs</span>
                    ) : (
                      <Collapse>
                        {_.map(spanLogViews, (logView) => (
                          <Panel
                            header={`Log @ ${prettyMilliseconds((logView.log.timestamp - span.startTime) / 1000, { formatSubMilliseconds: true })}`}
                            key={logView.id}
                            data-log-id={logView.id}
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
                    )}


                  </div>
                ) : null}
              </TabPane>
            </Tabs>
          </Sider>
      </Layout>

      </div>
    );
  }
}


export default TimelineScreen;
