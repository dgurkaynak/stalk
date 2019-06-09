import React from 'react';
// import * as _ from 'lodash';
import { PageHeader, List, Empty, Tag, Typography, Row, Col, Tooltip } from 'antd';
import SearchForm from './form';
import { SearchQuery } from '../../model/search/interfaces';
import DataSourceManager from '../../model/datasource/manager';
import { Trace } from '../../model/trace';
import prettyMilliseconds from 'pretty-ms';
import moment from 'moment';

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


  async onSearch(query: SearchQuery) {
    const api = DataSourceManager.getSingleton().apiFor(query.dataSource!);
    this.setState({ shouldShowResults: false });
    const result = await api.search(query);
    this.setState({
      shouldShowResults: true,
      searchResults: result.data.map(spans => new Trace(spans))
    });
  }


  render() {
    const { visible } = this.props;
    const { shouldShowResults } = this.state;

    return (
      <div style={{ display: visible ? 'block' : 'none' }}>
        <PageHeader
          className="pageheader-with-button"
          backIcon={false}
          title="Search Traces"
        >
          <SearchForm onSearch={this.binded.onSearch} />
        </PageHeader>

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
              <Text style={{ position: 'absolute', top: 10, right: 10 }}>
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
