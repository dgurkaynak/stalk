import * as _ from 'lodash';
import React from 'react';
import { Icon, Layout, Empty, Badge, Card, Tooltip, Menu, Dropdown, Divider, Alert } from 'antd';
import { Stage, StageEvent } from '../../model/stage';
import ColorManagers from '../color/managers';
import TimelineView from './view';
import { TimelineInteractableElementType, TimelineInteractedElementObject } from './interaction';
import { MouseHandlerEvent } from './mouse-handler';
import prettyMilliseconds from 'pretty-ms';
import scroll from 'scroll';
import SpanView from './span-view';
import processGroupingOptions from '../../model/span-grouping/process';
import serviceNameGroupingOptions from '../../model/span-grouping/service-name';
import traceGroupingOptions from '../../model/span-grouping/trace';
import SplitPane from 'react-split-pane';
import { Trace } from '../../model/trace';
import GroupView from './group-view';


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
  private hoveredTimelineElements: TimelineInteractedElementObject[] = [];
  private sidebarWidth = SIDEBAR_WIDTH;

  state = {
    stageTraces: this.stage.getAll(),
    groupingMode: processGroupingOptions.key, // Do not forget to change default value of TimelineViewSettings
    selectedSpanView: null,
    highlightedLogId: '',
  };
  binded = {
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    onSidebarContainerMouseMove: _.throttle(this.onSidebarContainerMouseMove.bind(this), 100),
    onSidebarContainerWheel: _.throttle(this.onSidebarContainerWheel.bind(this), 100),
    // Since we throttle mose move & wheel event, they can triggered after mouse leave,
    // That's why we need to delay it's execution.
    onSidebarContainerMouseLeave: () => setTimeout(this.onSidebarContainerMouseLeave.bind(this), 100),
    onGroupingModeMenuClick: this.onGroupingModeMenuClick.bind(this),
    onTimelineMouseIdleMove: this.onTimelineMouseIdleMove.bind(this),
    onTimelineMouseIdleLeave: this.onTimelineMouseIdleLeave.bind(this),
    onTimelineMousePanStart: this.onTimelineMousePanStart.bind(this),
    onTimelineMousePanMove: this.onTimelineMousePanMove.bind(this),
    onTimelineWheel: this.onTimelineWheel.bind(this),
    onTimelineClick: this.onTimelineClick.bind(this),
    onTimelineDoubleClick: this.onTimelineDoubleClick.bind(this),
    onSidebarSplitDragFinish: this.onSidebarSplitDragFinish.bind(this),
    resizeTimelineView: _.throttle(this.resizeTimelineView.bind(this), 500),
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
    this.timelineView.mouseHandler.on(MouseHandlerEvent.IDLE_MOVE, this.binded.onTimelineMouseIdleMove);
    this.timelineView.mouseHandler.on(MouseHandlerEvent.IDLE_LEAVE, this.binded.onTimelineMouseIdleLeave);
    this.timelineView.mouseHandler.on(MouseHandlerEvent.PAN_START, this.binded.onTimelineMousePanStart);
    this.timelineView.mouseHandler.on(MouseHandlerEvent.PAN_MOVE, this.binded.onTimelineMousePanMove);
    this.timelineView.mouseHandler.on(MouseHandlerEvent.WHEEL, this.binded.onTimelineWheel);
    this.timelineView.mouseHandler.on(MouseHandlerEvent.CLICK, this.binded.onTimelineClick);
    this.timelineView.mouseHandler.on(MouseHandlerEvent.DOUBLE_CLICK, this.binded.onTimelineDoubleClick);

    const sidebarContainerRef = this.sidebarContainerRef.current as HTMLDivElement;
    sidebarContainerRef.addEventListener('mousemove', this.binded.onSidebarContainerMouseMove, false);
    sidebarContainerRef.addEventListener('mouseleave', this.binded.onSidebarContainerMouseLeave, false);
    sidebarContainerRef.addEventListener('wheel', this.binded.onSidebarContainerWheel, false);
  }

  componentWillUnmount() {
    this.stage.removeListener(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.removeListener(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
    window.removeEventListener('resize', this.binded.resizeTimelineView, false);
    this.timelineView.mouseHandler.removeListener(MouseHandlerEvent.IDLE_MOVE, [this.binded.onTimelineMouseIdleMove] as any);
    this.timelineView.mouseHandler.removeListener(MouseHandlerEvent.IDLE_LEAVE, [this.binded.onTimelineMouseIdleLeave] as any);
    this.timelineView.mouseHandler.removeListener(MouseHandlerEvent.PAN_START, [this.binded.onTimelineMousePanStart] as any);
    this.timelineView.mouseHandler.removeListener(MouseHandlerEvent.PAN_MOVE, [this.binded.onTimelineMousePanMove] as any);
    this.timelineView.mouseHandler.removeListener(MouseHandlerEvent.WHEEL, [this.binded.onTimelineWheel] as any);
    this.timelineView.mouseHandler.removeListener(MouseHandlerEvent.CLICK, [this.binded.onTimelineClick] as any);
    this.timelineView.mouseHandler.removeListener(MouseHandlerEvent.DOUBLE_CLICK, [this.binded.onTimelineDoubleClick] as any);

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

  /**
   * Handle timeline mouse events
   */
  onTimelineMouseIdleMove(e: MouseEvent) {
    if (this.state.stageTraces.length === 0) return;

    // Update the cursor line
    if (this.timelineView.viewSettings.showCursorLine) {
      this.timelineView.annotation.cursorLineAnnotation.setTimestampFromScreenPositionX(e.offsetX);
      this.timelineView.annotation.cursorLineAnnotation.update();
      this.timelineView.annotation.cursorLineAnnotation.mount();
    }

    // TODO: Maybe debounce below?
    const matches = this.timelineView.getInteractedElementsFromMouseEvent(e);

    const previousHoveredElements = this.hoveredTimelineElements;
    this.hoveredTimelineElements = matches;

    const removed = _.differenceBy(previousHoveredElements, matches, ({element}) => element);
    const added = _.differenceBy(matches, previousHoveredElements, ({element}) => element);

    removed.forEach(({ type, element }) => {
      switch (type) {

        case TimelineInteractableElementType.SPAN_VIEW_LOG_CIRCLE: {
          const { spanId, id: logId } = SpanView.getPropsFromLogCircle(element);
          if (!spanId || !logId) return;
          const spanView = this.timelineView.findSpanView(spanId)[1];
          if (!spanView) return;
          spanView.updateLogStyle(logId, 'normal');
          return;
        }

        case TimelineInteractableElementType.SPAN_VIEW_CONTAINER: {
          const { id: spanId } = SpanView.getPropsFromContainer(element);
          if (!spanId) return;
          const spanView = this.timelineView.findSpanView(spanId)[1];
          if (!spanView) return;
          if (spanView === this.state.selectedSpanView) return;
          spanView.updateColorStyle('normal');
          return;
        }

      }
    });

    added.forEach(({ type, element }) => {
      switch (type) {

        case TimelineInteractableElementType.SPAN_VIEW_LOG_CIRCLE: {
          const { spanId, id: logId } = SpanView.getPropsFromLogCircle(element);
          if (!spanId || !logId) return;
          const spanView = this.timelineView.findSpanView(spanId)[1];
          if (!spanView) return;
          spanView.updateLogStyle(logId, 'hover');
          return;
        }

        case TimelineInteractableElementType.SPAN_VIEW_CONTAINER: {
          const { id: spanId } = SpanView.getPropsFromContainer(element);
          if (!spanId) return;
          const spanView = this.timelineView.findSpanView(spanId)[1];
          if (!spanView) return;
          if (spanView === this.state.selectedSpanView) return;
          spanView.updateColorStyle('hover');
          return;
        }

      }
    });

    if (removed.length === 0 && added.length === 0) return;

    // Previous implementation
    const selectedSpanView = this.state.selectedSpanView! as SpanView;
    if (!selectedSpanView) return;

    this.setState({ highlightedLogId: '' });

    added.forEach(({ type, element }) => {
      if (type !== TimelineInteractableElementType.SPAN_VIEW_LOG_CIRCLE) return;
      const { spanId, id: logId } = SpanView.getPropsFromLogCircle(element);
      if (!spanId || !logId) return;
      if (spanId !== selectedSpanView.span.id) return;
      this.highlightAndScrollToLog(logId);
    });
  }

  onTimelineMouseIdleLeave(e: MouseEvent) {
    // Hide cursor line
    this.timelineView.annotation.cursorLineAnnotation.unmount();
  }

  onTimelineMousePanStart(e: MouseEvent) {
    // Hide cursor line
    this.timelineView.annotation.cursorLineAnnotation.unmount();
  }

  onTimelineMousePanMove(e: MouseEvent) {
    this.timelineView.viewSettings.getAxis().translate(e.movementX);
    this.timelineView.updatePanelsTranslateY(e.movementY);
  }

  onTimelineWheel(e: WheelEvent) {
    if (this.state.stageTraces.length === 0) return;

    this.timelineView.viewSettings.getAxis().zoom(
      1 - (this.timelineView.viewSettings.scrollToZoomFactor * e.deltaY),
      e.offsetX
    );
  }

  onTimelineClick(e: MouseEvent) {
    if (!e) return; // Sometimes event can be garbage-collected
    const matches = this.timelineView.getInteractedElementsFromMouseEvent(e);

    const previousSelectedSpan: SpanView = this.state.selectedSpanView as any;
    if (previousSelectedSpan) {
      previousSelectedSpan.updateColorStyle('normal');
      this.setState({ selectedSpanView: undefined });
    }

    let clickedLogId: string | null = null;

    _.forEach(matches, ({ type, element }) => {
      switch (type) {

        case TimelineInteractableElementType.SPAN_VIEW_LOG_CIRCLE: {
          const { spanId, id: logId } = SpanView.getPropsFromLogCircle(element);
          if (!spanId || !logId) return;
          clickedLogId = logId;
          return;
        }

        case TimelineInteractableElementType.SPAN_VIEW_CONTAINER: {
          const { id: spanId } = SpanView.getPropsFromContainer(element);
          if (!spanId) return;
          const [groupView, spanView] = this.timelineView.findSpanView(spanId);
          if (!spanView || !groupView) return;

          // Select this one and bring it to front
          spanView.updateColorStyle('selected');
          groupView.bringSpanViewToTop(spanId);

          this.timelineView.annotation.spanConnectionsAnnotation.prepare({ spanView });
          this.timelineView.annotation.spanConnectionsAnnotation.update();
          this.timelineView.annotation.spanConnectionsAnnotation.mount();

          this.timelineView.annotation.intervalHighlightAnnotation.prepare({
            startTimestamp: spanView.span.startTime,
            finishTimestamp: spanView.span.finishTime,
            lineColor: 'rgba(0, 0, 0, 0.5)',
            fillColor: `rgba(0, 0, 0, 0.035)`
          });
          this.timelineView.annotation.intervalHighlightAnnotation.update();
          this.timelineView.annotation.intervalHighlightAnnotation.mount();

          this.setState({ selectedSpanView: spanView }, () => {
            setTimeout(() => {
              if (!clickedLogId) return;
              this.highlightAndScrollToLog(clickedLogId);
            }, 250);
          });
          return;
        }

      }
    });

    if (!this.state.selectedSpanView) {
      this.setState({ selectedSpanView: null });
      this.timelineView.annotation.spanConnectionsAnnotation.unmount();
      this.timelineView.annotation.intervalHighlightAnnotation.unmount();
    }

  }

  onTimelineDoubleClick(e: MouseEvent) {
    if (!e) return; // Sometimes event can be garbage-collected
    const matches = this.timelineView.getInteractedElementsFromMouseEvent(e);

    matches.forEach(({ type, element }) => {
      switch (type) {

        case TimelineInteractableElementType.GROUP_VIEW_LABEL_TEXT: {
          const { id: groupId } = GroupView.getPropsFromLabelText(element);
          if (!groupId) return;
          const groupView = this.timelineView.findGroupView(groupId);
          if (!groupView) return;
          groupView && groupView.toggleView();
          return;
        }

        case TimelineInteractableElementType.SPAN_VIEW_CONTAINER: {
          const { id: spanId } = SpanView.getPropsFromContainer(element);
          if (!spanId) return;
          const [groupView] = this.timelineView.findSpanView(spanId);
          groupView && groupView.toggleSpanView(spanId);
          return;
        }

      }
    });

  }

  onSidebarContainerMouseMove(e: MouseEvent) {
    const selectedSpanView = this.state.selectedSpanView! as SpanView;
    if (!selectedSpanView) return;

    const element = e.target as Element;
    if (!element) return;
    const logContainerElement = element.closest(`div[id^='log-item']`);
    if (!logContainerElement) return;
    const logId = logContainerElement.id.replace('log-item-', '');

    this.timelineView.annotation.logHighlightAnnotation.prepare({ spanView: selectedSpanView, logId });
    this.timelineView.annotation.logHighlightAnnotation.mount();
    this.timelineView.annotation.logHighlightAnnotation.update();
  }

  onSidebarContainerMouseLeave(e: MouseEvent) {
    this.timelineView.annotation.logHighlightAnnotation.unmount();
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

  onGroupingModeMenuClick(data: any) {
    if (data.key === 'add-grouping') {
      // TODO: Open modal to add/test grouping
      return;
    }

    this.timelineView.viewSettings.setGroupingKey(data.key);
    this.setState({ groupingMode: data.key, selectedSpanView: null });
    // TODO: Instead of setting selectedSpanView to null,
    // you can keep it and select again
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
      </div>
    );
  }

  renderHeader() {
    return (
      <div className="timeline-screen-header">
        <div className="left">

          <Dropdown overlay={
            <Menu
              selectedKeys={[ this.state.groupingMode ]}
              onClick={this.binded.onGroupingModeMenuClick}
              style={{ marginLeft: 5 }}
            >
              <Menu.Item key={traceGroupingOptions.key}>
                Trace
              </Menu.Item>
              <Menu.Item key={processGroupingOptions.key}>
                Process
              </Menu.Item>
              <Menu.Item key={serviceNameGroupingOptions.key}>
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
    );
  }

  renderSidebar() {
    if (!this.state.selectedSpanView) {
      return <div style={{ margin: 15 }}>No span selected</div>;
    }

    const selectedSpanView: SpanView = this.state.selectedSpanView as any;
    const tagCount = Object.keys(selectedSpanView.span.tags).length;
    const logsCount = selectedSpanView.getLogViews().length;

    return (
      <>
        <Divider orientation="center" style={{ marginTop: 10 }}>Span Info</Divider>
        {this.renderSpanInfo()}

        <Divider orientation="center">{tagCount} Tag(s)</Divider>
        {this.renderSpanTags()}

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
