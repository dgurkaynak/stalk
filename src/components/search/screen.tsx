import React from 'react';
import * as _ from 'lodash';
import { PageHeader, List, Empty, Tag, Typography, Row, Col, Tooltip, Affix } from 'antd';
import SearchForm from './form';
import { SearchQuery } from '../../model/search/interfaces';
import DataSourceManager from '../../model/datasource/manager';
import { Trace } from '../../model/trace';
import prettyMilliseconds from 'pretty-ms';
import moment from 'moment';
import chroma from 'chroma-js';
import { TraceDurationScatterPlot } from '../ui/trace-duration-scatter-plot';

const { Text } = Typography;


export interface SearchScreenProps {
  visible: boolean
}


export class SearchScreen extends React.Component<SearchScreenProps> {
  state = {
    shouldShowResults: false,
    searchResults: [] as Trace[]
  };
  binded = {
    onSearch: this.onSearch.bind(this)
  };
  chromaScale = chroma.scale(['#000', '#f00']).mode('lab');
  container: HTMLDivElement | null = null;


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


  render() {
    const { visible } = this.props;
    const { shouldShowResults, searchResults } = this.state;

    return (
      <div
        style={{ display: visible ? 'block' : 'none', overflow: 'auto', height: '100vh' }}
        ref={node => this.container = node}
      >
        <PageHeader
          className="pageheader-with-button"
          backIcon={false}
          title="Search Traces"
        >
          <SearchForm onSearch={this.binded.onSearch} />
        </PageHeader>

        {shouldShowResults && searchResults && searchResults.length > 0 ? (
          <Affix target={() => this.container}>
            <TraceDurationScatterPlot
              traces={searchResults}
              width="100%"
              height={300}
              style={{ backgroundColor: '#F0F2F5' }}
            />
          </Affix>
        ) : null}

        {shouldShowResults ? (
          <div style={{ background: '#fff', margin: 24, borderRadius: 3 }}>
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
          <List.Item style={{ padding: 10, position: 'relative' }} >
            <List.Item.Meta
              style={{ marginBottom: 0 }}
              title={
                <>
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
