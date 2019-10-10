import React from 'react';
import { PageHeader, Icon, Layout, Tabs, Select, Divider, Badge, Empty } from 'antd';
import { Stage, StageEvent } from '../../model/stage';
import ColorManagers from '../color/managers';


import './timeline.css';
const { Sider, Content } = Layout;
const { TabPane } = Tabs;
const { Option } = Select;


export interface TimelineScreenProps {
  visible: boolean
}


export class TimelineScreen extends React.Component<TimelineScreenProps> {
  private stage = Stage.getSingleton();
  state = {
    traceGroups: this.stage.grouping.trace.getAllGroups(),
    groupingMode: 'trace',
    isSidebarVisible: true,
    sidebarSelectedTab: 'general',
  };
  binded = {
    onStageUpdated: this.onStageUpdated.bind(this),
    onGroupingModeChange: this.onGroupingModeChange.bind(this),
  };


  componentDidMount() {
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageUpdated);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageUpdated);
  }


  componentWillUnmount() {
    this.stage.removeListener(StageEvent.TRACE_ADDED, this.binded.onStageUpdated);
    this.stage.removeListener(StageEvent.TRACE_REMOVED, this.binded.onStageUpdated);
  }


  onStageUpdated() {
    this.setState({ traceGroups: this.stage.grouping.trace.getAllGroups() });
  }


  onGroupingModeChange(value: string) {
    this.setState({ groupingMode: value });
  }


  render() {
    return (
      <div style={{ display: this.props.visible ? 'block' : 'none', overflow: 'auto', height: '100vh' }}>
        <Layout style={{ minHeight: '100%' }}>
          <Content>
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
                  onClick={() => this.setState({ isSidebarVisible: !this.state.isSidebarVisible })}
                />
              ]}
            ></PageHeader>
          </Content>

          <Sider
            trigger={null}
            collapsible
            collapsedWidth={0}
            collapsed={!this.state.isSidebarVisible}
            className="timeline-sidebar"
            width={256}
            theme="light"
          >
            <Tabs activeKey={this.state.sidebarSelectedTab}>
              <TabPane tab="General" key="general">
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

              </TabPane>

              <TabPane tab="Span Info" key="span-info" disabled={true}>
                Content of Tab Pane 2
              </TabPane>
            </Tabs>
          </Sider>
      </Layout>

      </div>
    );
  }
}


export default TimelineScreen;
