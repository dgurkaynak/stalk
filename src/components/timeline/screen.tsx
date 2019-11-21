import * as _ from 'lodash';
import React from 'react';
import { Icon, Layout, Empty, Badge, Tooltip, Menu, Dropdown, Divider, message } from 'antd';
import { Stage, StageEvent } from '../../model/stage';
import TimelineView, { TimelineEvent } from './timeline';
import SpanView from './span-view';
import processGroupingOptions from '../../model/span-grouping/process';
import serviceNameGroupingOptions from '../../model/span-grouping/service-name';
import traceGroupingOptions from '../../model/span-grouping/trace';
import { Trace } from '../../model/trace';
import { GroupLayoutType } from './group-view';
import SpanColoringManager, { SpanColoringRawOptions, SpanColoringOptions, operationColoringOptions, serviceColoringOptions } from '../../model/span-coloring-manager';
import SpanLabellingManager, { SpanLabellingRawOptions, SpanLabellingOptions, operationLabellingOptions, serviceOperationLabellingOptions } from '../../model/span-labelling-manager';
import SpanGroupingFormModal from '../customization/span-grouping/form-modal';
import SpanColoringFormModal from '../customization/span-coloring/form-modal';
import SpanLabellingFormModal from '../customization/span-labelling/form-modal';
import SpanGroupingManager from '../../model/span-grouping/manager';
import { SpanGroupingOptions, SpanGroupingRawOptions } from '../../model/span-grouping/span-grouping';
import vc from './view-constants';

import {
  ReflexContainer,
  ReflexSplitter,
  ReflexElement
} from 'react-reflex';
import 'react-reflex/styles.css';


import './timeline.css';
const { Content } = Layout;


export interface TimelineScreenProps {
  visible: boolean,
  onDataSourceClick: () => void,
  onSearchTraceClick: () => void,
}
const HEADER_MENU_HEIGHT = 45;

export class TimelineScreen extends React.Component<TimelineScreenProps> {
  private stage = Stage.getSingleton();
  private timelineContainerRef = React.createRef();
  private timelineView = new TimelineView();
  private customSpanGroupingRawOptions: SpanGroupingRawOptions | undefined;
  private customSpanColoringRawOptions: SpanColoringRawOptions | undefined;
  private customSpanLabellingRawOptions: SpanLabellingRawOptions | undefined;

  state = {
    stageTraces: this.stage.getAll(),
    groupLayoutMode: GroupLayoutType.FILL,
    spanGroupingMode: processGroupingOptions.key, // Do not forget to change default value of TimelineView
    spanColoringMode: operationColoringOptions.key, // Do not forget to change default value of TimelineView
    spanLabellingMode: operationLabellingOptions.key, // Do not forget to change default value of TimelineView
    selectedSpanView: null,
    isCustomSpanColoringFormModalVisible: false,
    isCustomSpanLabellingFormModalVisible: false,
    isCustomSpanGroupingFormModalVisible: false,
  };
  binded = {
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    onGroupLayoutModeMenuClick: this.onGroupLayoutModeMenuClick.bind(this),
    onSpanGroupingModeMenuClick: this.onSpanGroupingModeMenuClick.bind(this),
    onSpanColoringModeMenuClick: this.onSpanColoringModeMenuClick.bind(this),
    onSpanLabellingModeMenuClick: this.onSpanLabellingModeMenuClick.bind(this),
    resizeTimelineView: _.throttle(this.resizeTimelineView.bind(this), 500),
    onCustomSpanColoringFormModalSave: this.onCustomSpanColoringFormModalSave.bind(this),
    onCustomSpanLabellingFormModalSave: this.onCustomSpanLabellingFormModalSave.bind(this),
    onCustomSpanGroupingFormModalSave: this.onCustomSpanGroupingFormModalSave.bind(this),
    onTimelineReflexElementResize: this.onTimelineReflexElementResize.bind(this),
    onTimelineReflexElementResizeThrottle: _.throttle(this.onTimelineReflexElementResize.bind(this), 500),
  };

  componentDidMount() {
    this.init();
  }

  init() {
    // Re-flex package does not render it's children (our timeline container ref),
    // on componentDidMount. As a workaround, we keep retrying until ref is ready.
    if (!this.timelineContainerRef.current) {
      setTimeout(() => this.init(), 50);
      return;
    }

    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    window.addEventListener('resize', this.binded.resizeTimelineView, false);

    const containerEl = this.timelineContainerRef.current as HTMLDivElement;
    const { innerWidth, innerHeight } = window;
    this.timelineView.init(containerEl, {
      width: innerWidth,
      height: innerHeight - HEADER_MENU_HEIGHT - vc.bottomPaneHeight
    });

    this.timelineView.on(TimelineEvent.SPANS_SELECTED, (spanView: SpanView | null) => {
      this.setState({ selectedSpanView: spanView });
    });
  }

  componentWillUnmount() {
    this.stage.removeListener(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.removeListener(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    window.removeEventListener('resize', this.binded.resizeTimelineView, false);

    this.timelineView.dispose(); // This will dispose its all listeners, including span_select
  }

  onStageTraceAdded(trace: Trace) {
    this.setState({
      stageTraces: this.stage.getAll(),
      selectedSpanView: null,
    });
    this.timelineView.addTrace(trace);
  }

  onStageTraceRemoved(trace: Trace) {
    this.setState({
      stageTraces: this.stage.getAll(),
      selectedSpanView: null,
    });
    this.timelineView.removeTrace(trace);
  }

  onGroupLayoutModeMenuClick(data: any) {
    this.timelineView.updateGroupLayoutMode(data.key);
    this.setState({ groupLayoutMode: data.key, selectedSpanView: null });
    // TODO: Instead of setting selectedSpanView to null,
    // you can keep it and select again
  }

  onSpanGroupingModeMenuClick(data: any) {
    if (data.key === 'manage-all') {
      // TODO
      return;
    }

    if (data.key === 'custom') {
      this.setState({ isCustomSpanGroupingFormModalVisible: true });
      return;
    }

    const spanGroupingOptions = SpanGroupingManager.getSingleton().getOptions(data.key);
    if (!spanGroupingOptions) {
      message.error(`Unknown span grouping: "${data.key}"`);
      return;
    }

    this.timelineView.updateSpanGrouping(spanGroupingOptions);
    this.setState({ spanGroupingMode: data.key, selectedSpanView: null });
    // TODO: Instead of setting selectedSpanView to null,
    // you can keep it and select again
  }

  onSpanColoringModeMenuClick(data: any) {
    if (data.key === 'manage-all') {
      // TODO
      return;
    }

    if (data.key === 'custom') {
      this.setState({ isCustomSpanColoringFormModalVisible: true });
      return;
    }

    const spanColoringOptions = SpanColoringManager.getSingleton().getOptions(data.key);
    if (!spanColoringOptions) {
      message.error(`Unknown span coloring: "${data.key}"`);
      return;
    }

    this.timelineView.updateSpanColoring(spanColoringOptions);
    this.setState({ spanColoringMode: data.key });
  }

  onSpanLabellingModeMenuClick(data: any) {
    if (data.key === 'manage-all') {
      // TODO
      return;
    }

    if (data.key === 'custom') {
      this.setState({ isCustomSpanLabellingFormModalVisible: true });
      return;
    }

    const spanLabellingOptions = SpanLabellingManager.getSingleton().getOptions(data.key);
    if (!spanLabellingOptions) {
      message.error(`Unknown span labelling: "${data.key}"`);
      return;
    }

    this.timelineView.updateSpanLabelling(spanLabellingOptions);
    this.setState({ spanLabellingMode: data.key });
  }

  onCustomSpanGroupingFormModalSave(options: SpanGroupingOptions, rawOptions: SpanGroupingRawOptions) {
    this.customSpanGroupingRawOptions = rawOptions;
    this.timelineView.updateSpanGrouping(options);
    this.setState({ spanGroupingMode: 'custom', isCustomSpanGroupingFormModalVisible: false });
  }

  onCustomSpanColoringFormModalSave(options: SpanColoringOptions, rawOptions: SpanColoringRawOptions) {
    this.customSpanColoringRawOptions = rawOptions;
    this.timelineView.updateSpanColoring(options);
    this.setState({ spanColoringMode: 'custom', isCustomSpanColoringFormModalVisible: false });
  }

  onCustomSpanLabellingFormModalSave(options: SpanLabellingOptions, rawOptions: SpanLabellingRawOptions) {
    this.customSpanLabellingRawOptions = rawOptions;
    this.timelineView.updateSpanLabelling(options);
    this.setState({ spanLabellingMode: 'custom', isCustomSpanLabellingFormModalVisible: false });
  }

  resizeTimelineView() {
    if (this.timelineContainerRef.current && (this.timelineContainerRef.current as any).parentElement) {
      const { offsetWidth, offsetHeight } = (this.timelineContainerRef.current as any).parentElement;
      this.timelineView.resize(offsetWidth, offsetHeight);
    }
  }

  onTimelineReflexElementResize(options: { domElement: HTMLElement }) {
    const { offsetWidth, offsetHeight } = options.domElement;
    this.timelineView.resize(offsetWidth, offsetHeight);
  }

  render() {
    return (
      <div style={{
        display: this.props.visible ? 'block' : 'none',
        overflow: 'auto',
        height: '100vh'
      }}>
        <Layout style={{ height: '100%', overflow: 'hidden' }}>
          <Content style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {this.renderHeader()}

            <ReflexContainer orientation="horizontal">
              <ReflexElement
                onResize={this.binded.onTimelineReflexElementResize}
                onStopResize={this.binded.onTimelineReflexElementResizeThrottle}
                style={{ overflowY: 'hidden' }}
              >
                <div ref={this.timelineContainerRef as any}></div>
              </ReflexElement>

              <ReflexSplitter/>

              <ReflexElement size={vc.bottomPaneHeight}>

                <ReflexContainer orientation="vertical">
                  <ReflexElement flex={0.25}>
                    <div className="pane-content">
                      <label>
                      Left Pane (resizable)
                      </label>
                    </div>
                  </ReflexElement>

                  <ReflexSplitter propagate={true}/>

                  <ReflexElement flex={0.25}>
                    <div className="pane-content">
                      <label>
                      Middle Pane 1 (resizable)
                      </label>
                    </div>
                  </ReflexElement>

                  <ReflexSplitter propagate={true}/>

                  <ReflexElement flex={0.5}>
                    <div className="pane-content">
                      <label>
                      Right Pane (resizable)
                      </label>
                    </div>
                  </ReflexElement>

                </ReflexContainer>

              </ReflexElement>

            </ReflexContainer>

          </Content>
        </Layout>

        <SpanGroupingFormModal
          visible={this.state.isCustomSpanGroupingFormModalVisible}
          modalTitle="Custom Span Grouping"
          hideNameField={true}
          rawOptions={this.customSpanGroupingRawOptions}
          onSave={this.binded.onCustomSpanGroupingFormModalSave}
          onCancel={() => this.setState({ isCustomSpanGroupingFormModalVisible: false })}
        />

        <SpanColoringFormModal
          visible={this.state.isCustomSpanColoringFormModalVisible}
          modalTitle="Custom Span Coloring"
          hideNameField={true}
          rawOptions={this.customSpanColoringRawOptions}
          onSave={this.binded.onCustomSpanColoringFormModalSave}
          onCancel={() => this.setState({ isCustomSpanColoringFormModalVisible: false })}
        />

        <SpanLabellingFormModal
          visible={this.state.isCustomSpanLabellingFormModalVisible}
          modalTitle="Custom Span Labelling"
          hideNameField={true}
          rawOptions={this.customSpanLabellingRawOptions}
          onSave={this.binded.onCustomSpanLabellingFormModalSave}
          onCancel={() => this.setState({ isCustomSpanLabellingFormModalVisible: false })}
        />
      </div>
    );
  }

  renderHeader() {
    return (
      <div className="timeline-screen-header">
        <div className="left">

          <Tooltip placement="bottom" title="Data Sources" mouseEnterDelay={1}>
            <span className="timeline-header-button" onClick={() => this.props.onDataSourceClick && this.props.onDataSourceClick()}>
              <Icon type="database" />
            </span>
          </Tooltip>

          <Tooltip placement="bottom" title="Search Traces" mouseEnterDelay={1}>
            <span className="timeline-header-button" onClick={() => this.props.onSearchTraceClick && this.props.onSearchTraceClick()}>
              <Icon type="search" />
            </span>
          </Tooltip>

          <Divider type="vertical" />

          <Dropdown overlay={
            <div style={{ background: '#fff', width: 300, marginLeft: 5, overflowY: 'auto', borderRadius: 4, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' }}>
              {this.state.stageTraces.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No trace added to stage" />
              ) : null}

              {this.state.stageTraces.map((trace, i) => (
                <div className="sidebar-row" key={i}>
                  <span>{trace.name}</span>
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

          <Tooltip placement="bottom" title="Table View" mouseEnterDelay={1}>
            <span className="timeline-header-button">
              <Icon type="table" />
            </span>
          </Tooltip>

        </div>

        <div className="center">

          <Dropdown overlay={
            <Menu
              selectedKeys={[ this.state.groupLayoutMode ]}
              onClick={this.binded.onGroupLayoutModeMenuClick}
            >
              <Menu.Item key={GroupLayoutType.FILL}>Fill</Menu.Item>
              <Menu.Item key={GroupLayoutType.COMPACT}>Compact</Menu.Item>
              <Menu.Item key={GroupLayoutType.WATERFALL}>Waterfall</Menu.Item>
            </Menu>
          } trigger={['click']}>
            <Tooltip placement="left" title="Group Layout Mode" mouseEnterDelay={1}>
              <span className="timeline-header-button">
                <Icon type="build" />
              </span>
            </Tooltip>
          </Dropdown>

          <Dropdown overlay={
            <Menu
              selectedKeys={[ this.state.spanGroupingMode ]}
              onClick={this.binded.onSpanGroupingModeMenuClick}
              style={{ marginLeft: 5 }}
            >
              <Menu.Item key={traceGroupingOptions.key}>{traceGroupingOptions.name}</Menu.Item>
              <Menu.Item key={processGroupingOptions.key}>{processGroupingOptions.name}</Menu.Item>
              <Menu.Item key={serviceNameGroupingOptions.key}>{serviceNameGroupingOptions.name}</Menu.Item>
              <Menu.Divider />
              <Menu.Item key="custom">
                <Icon type="code" /> Custom
              </Menu.Item>
              <Menu.Item key="manage-all" disabled={true}>
                <Icon type="setting" /> Manage All
              </Menu.Item>
            </Menu>
          } trigger={['click']}>
            <Tooltip placement="left" title="Grouping Mode" mouseEnterDelay={1}>
              <span className="timeline-header-button">
                <Icon type="team" />
              </span>
            </Tooltip>
          </Dropdown>

          <Dropdown overlay={
            <Menu
              selectedKeys={[ this.state.spanLabellingMode ]}
              onClick={this.binded.onSpanLabellingModeMenuClick}
            >
              <Menu.Item key={operationLabellingOptions.key}>{operationLabellingOptions.name}</Menu.Item>
              <Menu.Item key={serviceOperationLabellingOptions.key}>{serviceOperationLabellingOptions.name}</Menu.Item>
              <Menu.Divider />
              <Menu.Item key="custom">
                <Icon type="code" /> Custom
              </Menu.Item>
              <Menu.Item key="manage-all" disabled={true}>
                <Icon type="setting" /> Manage All
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
            <Menu
              selectedKeys={[ this.state.spanColoringMode ]}
              onClick={this.binded.onSpanColoringModeMenuClick}
            >
              <Menu.Item key={operationColoringOptions.key}>{operationColoringOptions.name}</Menu.Item>
              <Menu.Item key={serviceColoringOptions.key}>{serviceColoringOptions.name}</Menu.Item>
              <Menu.Divider />
              <Menu.Item key="custom">
                <Icon type="code" /> Custom
              </Menu.Item>
              <Menu.Item key="manage-all" disabled={true}>
                <Icon type="setting" /> Manage All
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

          <Tooltip placement="left" title="Toggle bottom pane" mouseEnterDelay={1}>
            <span className="timeline-header-button">
              <Icon type="layout" />
            </span>
          </Tooltip>

          <Tooltip placement="left" title="Settings" mouseEnterDelay={1}>
            <span className="timeline-header-button">
              <Icon type="setting" />
            </span>
          </Tooltip>

        </div>
      </div>
    );
  }

}


export default TimelineScreen;
