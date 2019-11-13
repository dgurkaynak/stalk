import * as _ from 'lodash';
import React from 'react';
import { Icon, Layout, Empty, Badge, Card, Tooltip, Menu, Dropdown, Divider, message } from 'antd';
import { Stage, StageEvent } from '../../model/stage';
import TimelineView, { TimelineViewEvent } from './timeline-view';
import prettyMilliseconds from 'pretty-ms';
import scroll from 'scroll';
import SpanView from './span-view';
import processGroupingOptions from '../../model/span-grouping/process';
import serviceNameGroupingOptions from '../../model/span-grouping/service-name';
import traceGroupingOptions from '../../model/span-grouping/trace';
import SplitPane from 'react-split-pane';
import { Trace } from '../../model/trace';
import { GroupLayoutType } from './group-view';
import SpanColoringManager, { SpanColoringRawOptions, SpanColoringOptions, operationColoringOptions, serviceColoringOptions } from '../../model/span-coloring-manager';
import SpanLabellingManager, { SpanLabellingRawOptions, SpanLabellingOptions, operationLabellingOptions, serviceOperationLabellingOptions } from '../../model/span-labelling-manager';
import SpanGroupingFormModal from '../customization/span-grouping/form-modal';
import SpanColoringFormModal from '../customization/span-coloring/form-modal';
import SpanLabellingFormModal from '../customization/span-labelling/form-modal';
import SpanGroupingManager from '../../model/span-grouping/manager';
import { SpanGroupingOptions, SpanGroupingRawOptions } from '../../model/span-grouping/span-grouping';


import './timeline.css';
const { Content } = Layout;


export interface TimelineScreenProps {
  visible: boolean
}

const SIDEBAR_WIDTH = 320;
const LEFT_MENU_WIDTH = 80;
const HEADER_MENU_HEIGHT = 45;

export class TimelineScreen extends React.Component<TimelineScreenProps> {
  private stage = Stage.getSingleton();
  private timelineContainerRef = React.createRef();
  private timelineView = new TimelineView();
  private sidebarContainerRef = React.createRef();
  private sidebarWidth = SIDEBAR_WIDTH;
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
    highlightedLogId: '',
    isCustomSpanColoringFormModalVisible: false,
    isCustomSpanLabellingFormModalVisible: false,
    isCustomSpanGroupingFormModalVisible: false,
  };
  binded = {
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    onSidebarContainerMouseMove: _.throttle(this.onSidebarContainerMouseMove.bind(this), 100),
    onSidebarContainerWheel: _.throttle(this.onSidebarContainerWheel.bind(this), 100),
    // Since we throttle mose move & wheel event, they can triggered after mouse leave,
    // That's why we need to delay it's execution.
    onSidebarContainerMouseLeave: () => setTimeout(this.onSidebarContainerMouseLeave.bind(this), 100),
    onGroupLayoutModeMenuClick: this.onGroupLayoutModeMenuClick.bind(this),
    onSpanGroupingModeMenuClick: this.onSpanGroupingModeMenuClick.bind(this),
    onSpanColoringModeMenuClick: this.onSpanColoringModeMenuClick.bind(this),
    onSpanLabellingModeMenuClick: this.onSpanLabellingModeMenuClick.bind(this),
    onSidebarSplitDragFinish: this.onSidebarSplitDragFinish.bind(this),
    resizeTimelineView: _.throttle(this.resizeTimelineView.bind(this), 500),
    onCustomSpanColoringFormModalSave: this.onCustomSpanColoringFormModalSave.bind(this),
    onCustomSpanLabellingFormModalSave: this.onCustomSpanLabellingFormModalSave.bind(this),
    onCustomSpanGroupingFormModalSave: this.onCustomSpanGroupingFormModalSave.bind(this),
  };

  componentDidMount() {
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    window.addEventListener('resize', this.binded.resizeTimelineView, false);

    const containerEl = this.timelineContainerRef.current as HTMLDivElement;
    const { innerWidth, innerHeight } = window;
    this.timelineView.init(containerEl, {
      width: innerWidth - LEFT_MENU_WIDTH - this.sidebarWidth,
      height: innerHeight - HEADER_MENU_HEIGHT
    });

    this.timelineView.on(TimelineViewEvent.SPAN_SELECTED, (spanView: SpanView | null) => {
      this.setState({ selectedSpanView: spanView });
    })

    const sidebarContainerRef = this.sidebarContainerRef.current as HTMLDivElement;
    sidebarContainerRef.addEventListener('mousemove', this.binded.onSidebarContainerMouseMove, false);
    sidebarContainerRef.addEventListener('mouseleave', this.binded.onSidebarContainerMouseLeave, false);
    sidebarContainerRef.addEventListener('wheel', this.binded.onSidebarContainerWheel, false);
  }

  componentWillUnmount() {
    this.stage.removeListener(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.removeListener(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    window.removeEventListener('resize', this.binded.resizeTimelineView, false);

    this.timelineView.dispose(); // This will dispose its all listeners, including span_select

    const sidebarContainerRef = this.sidebarContainerRef.current as HTMLDivElement;
    sidebarContainerRef.addEventListener('mousemove', this.binded.onSidebarContainerMouseMove, false);
    sidebarContainerRef.addEventListener('mouseleave', this.binded.onSidebarContainerMouseLeave, false);
    sidebarContainerRef.addEventListener('wheel', this.binded.onSidebarContainerWheel, false);
  }

  onStageTraceAdded(trace: Trace) {
    this.setState({
      stageTraces: this.stage.getAll(),
      selectedSpanView: null,
      highlightedLogId: '',
    });
    this.timelineView.addTrace(trace);
  }

  onStageTraceRemoved(trace: Trace) {
    this.setState({
      stageTraces: this.stage.getAll(),
      selectedSpanView: null,
      highlightedLogId: '',
    });
    this.timelineView.removeTrace(trace);
  }

  onSidebarContainerMouseMove(e: MouseEvent) {
    const selectedSpanView = this.state.selectedSpanView! as SpanView;
    if (!selectedSpanView) return;

    const element = e.target as Element;
    if (!element) return;
    const logContainerElement = element.closest(`div[id^='log-item']`);
    if (!logContainerElement) return;
    const logId = logContainerElement.id.replace('log-item-', '');

    this.timelineView.decorations.logHighlight.prepare({ spanId: selectedSpanView.span.id, logId });
    this.timelineView.decorations.logHighlight.mount();
    this.timelineView.decorations.logHighlight.update();
  }

  onSidebarContainerMouseLeave(e: MouseEvent) {
    this.timelineView.decorations.logHighlight.unmount();
  }

  onSidebarContainerWheel(e: WheelEvent) {
    // Wheel event.target is not changing, it's always the element scroll is started on
    // That's why we get the real element at that coordinate, pass it to `onSidebarContainerMouseMove`
    this.onSidebarContainerMouseMove({ target: document.elementFromPoint(e.clientX, e.clientY) } as any);
  }

  highlightAndScrollToLog(logId: string) {
    const logItemEl = document.getElementById(`log-item-${logId}`);
    if (!logItemEl) return;
    if (!this.sidebarContainerRef || !this.sidebarContainerRef.current) return;

    const sidebarContainer = this.sidebarContainerRef.current as HTMLDivElement;
    const { offsetTop } = logItemEl;
    const logsPaneRect = sidebarContainer.getBoundingClientRect();
    const logItemRect = logItemEl.getBoundingClientRect();


    if (logItemRect.top >= logsPaneRect.top && logItemRect.bottom <= logsPaneRect.bottom) {
      // Log panel is completely visible, NOOP
    } else {
      scroll.top(sidebarContainer, offsetTop);
    }

    this.setState({ highlightedLogId: logId });
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

  onSidebarSplitDragFinish(sidebarWidth: number) {
    this.sidebarWidth = sidebarWidth;
    this.resizeTimelineView();
  }

  resizeTimelineView() {
    const { innerWidth, innerHeight } = window;
    this.timelineView.resize(
      innerWidth - LEFT_MENU_WIDTH - this.sidebarWidth,
      innerHeight - HEADER_MENU_HEIGHT
    );
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

            <SplitPane
              split="vertical"
              defaultSize={SIDEBAR_WIDTH}
              minSize={200}
              primary="second"
              style={{ position: 'relative' }} // This forces fitting to container
              onDragFinished={this.binded.onSidebarSplitDragFinish}
              resizerStyle={{ opacity: 0.2 }}
            >
              {/* Timeline view container, make it absolute so that it doesn't
              prevent split pane to resize smaller than current width*/}
              <div ref={this.timelineContainerRef as any} style={{ position: 'absolute' }}></div>

              <div className="timeline-sidebar" ref={this.sidebarContainerRef as any}>
                {this.renderSidebar()}
              </div>
            </SplitPane>
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

          <Divider type="vertical" />

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
            <Tooltip placement="right" title="Group Layout Mode" mouseEnterDelay={1}>
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
            <Tooltip placement="right" title="Grouping Mode" mouseEnterDelay={1}>
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

        </div>
      </div>
    );
  }

  renderSidebar() {
    if (!this.state.selectedSpanView) {
      return <div style={{ margin: 15 }}>No span selected</div>;
    }

    const selectedSpanView = this.state.selectedSpanView as SpanView;
    const tagCount = Object.keys(selectedSpanView.span.tags).length;
    const logsCount = selectedSpanView.getLogViews().length;
    const processTags = (selectedSpanView.span.process && selectedSpanView.span.process.tags) || {};

    return (
      <>
        <Divider orientation="center" style={{ marginTop: 10 }}>Span Info</Divider>
        {this.renderSpanInfo()}

        <Divider orientation="center">{tagCount} Tag(s)</Divider>
        {this.renderSpanTags()}

        {Object.keys(processTags).length > 0 ? (
          <>
            <Divider orientation="center">{Object.keys(processTags).length} Process Tag(s)</Divider>
            {this.renderProcessTags()}
          </>
        ) : null}

        <Divider orientation="center">{logsCount} Log(s)</Divider>
        {this.renderSpanLogs()}
      </>
    );
  }

  renderSpanInfo() {
    const selectedSpanView: SpanView | undefined = this.state.selectedSpanView as any;
    if (!selectedSpanView) return null;
    const span = selectedSpanView.span;

    return (
      <div className="timeline-sidebar-content">
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
      </div>
    );
  }

  renderProcessTags() {
    const selectedSpanView: SpanView | undefined = this.state.selectedSpanView as any;
    if (!selectedSpanView) return null;
    const span = selectedSpanView.span;
    const processTags = (span.process && span.process.tags) || {};

    return (
      <div className="timeline-sidebar-content">
        {Object.keys(processTags).length > 0 ? _.map(processTags, (value, tag) => (
          <div className="sidebar-row mono even-odd" key={tag}>
            <span>{tag}:</span>
            <span>{value}</span>
          </div>
        )) : null}
      </div>
    );
  }

  renderSpanTags() {
    const selectedSpanView: SpanView | undefined = this.state.selectedSpanView as any;
    if (!selectedSpanView) return null;
    const span = selectedSpanView.span;

    return (
      <div className="timeline-sidebar-content">
        {Object.keys(span.tags).length > 0 ? _.map(span.tags, (value, tag) => (
          <div className="sidebar-row mono even-odd" key={tag}>
            <span>{tag}:</span>
            <span>{value}</span>
          </div>
        )) : null}
      </div>
    );
  }

  renderSpanLogs() {
    const selectedSpanView: SpanView | undefined = this.state.selectedSpanView as any;
    if (!selectedSpanView) return <div></div>;
    const span = selectedSpanView.span;
    const spanLogViews = selectedSpanView.getLogViews();
    if (spanLogViews.length === 0) return <div></div>;

    return (
      <div className="timeline-sidebar-content">
        {_.map(spanLogViews, (logView) => (
          <Card
            size="small"
            title={`Log @ ${prettyMilliseconds((logView.log.timestamp - span.startTime) / 1000, { formatSubMilliseconds: true })}`}
            // extra={<a href="#">Copy</a>}
            style={{ margin: '5px 0' }}
            key={logView.id}
            id={`log-item-${logView.id}`}
            className={logView.id === this.state.highlightedLogId ? 'sidebar-log-card-higlighted' : ''}
          >
            {_.map(logView.log.fields, (value, name) => (
              <div className="sidebar-row mono" key={name}>
                <span>{name}:</span>
                <span>{value}</span>
              </div>
            ))}
          </Card>
        ))}

        <div className="ant-alert" style={{ marginBottom: 10 }}>
          <Icon type="info-circle" theme="filled" className="ant-alert-icon" />
          <span className="ant-alert-message">Log timestamps are relative to the span</span>
        </div>
      </div>
    );
  }

}


export default TimelineScreen;
