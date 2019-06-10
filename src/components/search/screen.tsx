import React from 'react';
import * as _ from 'lodash';
import { PageHeader, List, Empty, Tag, Typography, Row, Col, Tooltip, Affix, Badge } from 'antd';
import SearchForm from './form';
import { SearchQuery } from '../../model/search/interfaces';
import DataSourceManager from '../../model/datasource/manager';
import { Trace } from '../../model/trace';
import prettyMilliseconds from 'pretty-ms';
import moment from 'moment';
import chroma from 'chroma-js';
import { TraceDurationScatterPlot } from '../ui/trace-duration-scatter-plot';
import ColorManagers from '../color/managers';

const { Text } = Typography;
const CHART_HEIGHT = 250;


export interface SearchScreenProps {
  visible: boolean
}


export class SearchScreen extends React.Component<SearchScreenProps> {
  state: {
    shouldShowResults: boolean,
    searchResults: Trace[],
    scatterPlotHighlightedTrace: Trace | undefined
  } = {
    shouldShowResults: false,
    searchResults: [] as Trace[],
    scatterPlotHighlightedTrace: undefined
  };
  binded = {
    onSearch: this.onSearch.bind(this),
    onAffixStateChange: this.onAffixStateChange.bind(this),
    onMouseEnterOnScatterPlotDot: this.onMouseEnterOnScatterPlotDot.bind(this),
    onMouseLeaveOnScatterPlotDot: this.onMouseLeaveOnScatterPlotDot.bind(this),
    onClickOnScatterPlotDot: this.onClickOnScatterPlotDot.bind(this)
  };
  chromaScale = chroma.scale(['#000', '#f00']).mode('lab');
  containerRef: HTMLDivElement | null = null;


  async onSearch(query: SearchQuery) {
    const api = DataSourceManager.getSingleton().apiFor(query.dataSource!);
    this.setState({ shouldShowResults: false });
    const result = await api.search(query);
    const traces = result.data.map(spans => new Trace(spans));
    const longestTrace = _.maxBy(traces, trace => trace.duration);
    if (longestTrace) this.chromaScale.domain([0, longestTrace.duration]);
    this.setState({
      shouldShowResults: true,
      searchResults: traces
    });
  }


  onMouseEnterOnItem(trace: Trace) {
    this.setState({ scatterPlotHighlightedTrace: trace });
  }


  onMouseLeaveOnItem(trace: Trace) {
    this.setState({ scatterPlotHighlightedTrace: null });
  }


  onAffixStateChange(affixed: boolean | undefined) {
    if (!this.containerRef) return;
    const svg = this.containerRef.querySelector('svg.trace-duration-scatter-plot') as SVGElement;
    if (!svg) return;
    if (affixed) svg.classList.add('affixed');
    else svg.classList.remove('affixed');
  }


  onMouseEnterOnScatterPlotDot(trace: Trace) {
    if (!this.containerRef) return;
    const item = this.containerRef.querySelector(`.search-result-item[data-traceid="${trace.id}"]`) as HTMLLIElement;
    if (!item) return;
    item.classList.add('highlighted');
  }


  onMouseLeaveOnScatterPlotDot(trace: Trace) {
    if (!this.containerRef) return;
    const item = this.containerRef.querySelector(`.search-result-item[data-traceid="${trace.id}"]`) as HTMLLIElement;
    if (!item) return;
    item.classList.remove('highlighted');
  }


  onClickOnScatterPlotDot(trace: Trace) {
    if (!this.containerRef) return;
    const item = this.containerRef.querySelector(`.search-result-item[data-traceid="${trace.id}"]`) as HTMLLIElement;
    if (!item) return;

    // Scroll to
    const containerBB = this.containerRef.getBoundingClientRect();
    const itemBB = item.getBoundingClientRect();
    const snapTo = containerBB.top + CHART_HEIGHT;

    if (itemBB.top > snapTo && itemBB.bottom < (containerBB.top + containerBB.height)) {
      // item in desired viewport, no scroll
    } else {
      const scrollOffset = itemBB.top - snapTo;
      this.containerRef.scrollTop += scrollOffset;
    }
  }


  render() {
    const { visible } = this.props;
    const { shouldShowResults, searchResults, scatterPlotHighlightedTrace } = this.state;

    return (
      <div
        style={{ display: visible ? 'block' : 'none', overflow: 'auto', height: '100vh' }}
        ref={node => this.containerRef = node}
      >
        <PageHeader
          className="pageheader-with-button"
          backIcon={false}
          title="Search Traces"
        >
          <SearchForm onSearch={this.binded.onSearch} />
        </PageHeader>

        {shouldShowResults && searchResults && searchResults.length > 0 ? (
          <Affix target={() => this.containerRef} onChange={this.binded.onAffixStateChange}>
            <TraceDurationScatterPlot
              traces={searchResults}
              width="100%"
              height={CHART_HEIGHT}
              style={{ backgroundColor: '#F0F2F5' }}
              highlightedTrace={scatterPlotHighlightedTrace}
              className="trace-duration-scatter-plot"
              onItemClick={this.binded.onClickOnScatterPlotDot}
              onItemMouseEnter={this.binded.onMouseEnterOnScatterPlotDot}
              onItemMouseLeave={this.binded.onMouseLeaveOnScatterPlotDot}
            />
          </Affix>
        ) : null}

        {shouldShowResults ? (
          <div style={{ background: '#fff', margin: 24, marginTop: 0, borderRadius: 3 }}>
            {this.renderSearchResults()}
          </div>
        ) : null}
      </div>
    );
  }


  renderSearchResults() {
    const { searchResults } = this.state;

    return searchResults.length > 0 ? (
      <List
        itemLayout="vertical"
        dataSource={searchResults}
        renderItem={item => (
          <List.Item
            style={{ padding: 10, position: 'relative' }}
            onMouseEnter={() => this.onMouseEnterOnItem(item)}
            onMouseLeave={() => this.onMouseLeaveOnItem(item)}
            data-traceid={item.id}
            className="search-result-item"
          >
            <List.Item.Meta
              style={{ marginBottom: 0 }}
              title={
                <>
                  <Badge
                    color={ColorManagers.operationName.colorFor(item.name) as string}
                    className="search-result-item-badge"
                  />
                  {item.name} &nbsp;
                  <Tag>{item.spanCount} {item.spanCount === 1 ? 'Span' : 'Spans'}</Tag>
                  {item.errorCount > 0 ? (
                    <Tag color="red">
                      {item.errorCount} {item.errorCount === 1 ? 'Error' : 'Errors'}
                    </Tag>
                  ) : null}
                </>
              }
            />

            <Tooltip
              title={prettyMilliseconds(item.duration / 1000, { formatSubMilliseconds: true })}
              placement="left"
            >
              <Text style={{ position: 'absolute', top: 10, right: 10, color: this.chromaScale(item.duration).hex() }}>
                {/* TODO: Remove string replace
                    https://github.com/sindresorhus/pretty-ms/issues/32 */}
                {prettyMilliseconds(item.duration / 1000, { compact: true, formatSubMilliseconds: true }).replace('~', '')}
              </Text>
            </Tooltip>

            <Row type="flex" justify="space-between" align="bottom">
              <Col span={20}>
                <List
                  itemLayout="horizontal"
                  dataSource={Object.keys(item.spanCountsByService).sort()}
                  renderItem={serviceName => (
                    <Tag style={{ background: '#fff', borderStyle: 'dashed' }}>
                      {serviceName} ({item.spanCountsByService[serviceName]})
                    </Tag>
                  )}
                />
              </Col>
              <Col span={4} style={{ textAlign: 'right' }}>
                <Tooltip
                  title={moment(item.startTime / 1000).format('ddd, D MMMM, HH:mm:ss.SSS')}
                  placement="left"
                >
                  <Text style={{ fontSize: '0.8em', color: 'rgba(0, 0, 0, 0.25)' }}>
                    {moment(item.startTime / 1000).fromNow()}
                  </Text>
                </Tooltip>

              </Col>
            </Row>
          </List.Item>
        )}
      />
    ) : (
      <Empty
        description="No traces found for the search criteria"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ padding: 24 }}
      />
    );
  }
}


export default SearchScreen;
