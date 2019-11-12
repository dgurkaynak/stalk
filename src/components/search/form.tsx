import React from 'react';
import { Tooltip, Form, Row, Col, Input, Button, Icon, Select, DatePicker, TimePicker, InputNumber, Tag, message, Popover, Typography } from 'antd';
import DataSourceManager from '../../model/datasource/manager';
import DataSourceSelect from '../datasource/select';
import { DataSource, DataSourceType } from '../../model/datasource/interfaces';
import { ServiceOrOperationSelect, ServiceOrOperationEntity } from './service-or-operation-select';
import moment from 'moment';
// import _ from 'lodash';
import parse from 'parse-duration';
import { SearchQuery } from '../../model/api/interfaces';


const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

const timeFormat = 'HH:mm';


export interface SearchFormProps {
  form: any,
  onSearch: (query: SearchQuery) => void
}


export interface SearchFormState {
  dataSource: DataSource | null,
  serviceOrOperation: ServiceOrOperationEntity | null,
  lookback: string,
  limit: number,
  dateRange: [ moment.Moment, moment.Moment ] | null,
  startTime: moment.Moment,
  finishTime: moment.Moment,
  tagItems: string[],
  tagInputVisible: boolean,
  tagInputValue: string,
  minDuration: string | null,
  maxDuration: string | null
}


export const SearchForm: any = Form.create({ name: 'search-form' })(
  class extends React.Component<SearchFormProps> {
    tagInputRef: any;
    state: SearchFormState = {
      // Do not auto-select first one, ServiceOrOperation component acts wierdly
      dataSource: null, // DataSourceManager.getAll()[0],
      serviceOrOperation: null,
      lookback: '1h',
      limit: 20,
      dateRange: null,
      startTime: moment('00:00:00', timeFormat),
      finishTime: moment('23:59:59', timeFormat),
      tagItems: [],
      tagInputVisible: false,
      tagInputValue: '',
      minDuration: null,
      maxDuration: null
    };
    binded = {
      onDataSourceChange: this.onDataSourceChange.bind(this),
      onServiceOrOperationChange: this.onServiceOrOperationChange.bind(this),
      onLookbackChange: this.onLookbackChange.bind(this),
      onClear: this.onClear.bind(this),
      onSearch: this.onSearch.bind(this),
      onLimitChange: this.onLimitChange.bind(this),
      onDateRangeChanged: this.onDateRangeChanged.bind(this),
      onStartTimeChanged: this.onStartTimeChanged.bind(this),
      onEndTimeChanged: this.onEndTimeChanged.bind(this),
      onTagRemove: this.onTagRemove.bind(this),
      saveTagInputRef: this.saveTagInputRef.bind(this),
      onTagInputChange: this.onTagInputChange.bind(this),
      onTagInputConfirm: this.onTagInputConfirm.bind(this),
      showTagInput: this.showTagInput.bind(this),
      onMinDurationChange: this.onMinDurationChange.bind(this),
      onMaxDurationChange: this.onMaxDurationChange.bind(this),
      isJsonDataSourceSelected: this.isJsonDataSourceSelected.bind(this),
    };


    async onDataSourceChange(dataSource: DataSource | null) {
      this.setState({ serviceOrOperation: null });
      this.props.form.setFieldsValue({ dataSource, serviceOrOperation: null });

      if (dataSource) {
        try {
          const api = DataSourceManager.getSingleton().apiFor(dataSource);
          await api.updateServicesAndOperationsCache();
          this.setState({ dataSource });

          if (dataSource.type == DataSourceType.ZIPKIN_JSON || dataSource.type == DataSourceType.JAEGER_JSON) {
            this.props.form.validateFields((err: any, values: any) => {
              if (err) return;
              const query = this.toQuery();
              this.props.onSearch(query);
            });
          }
        } catch (err) {
          message.error(`Could not access to "${dataSource.name}": ${err.message}`);
        }
      }
    }


    onServiceOrOperationChange(serviceOrOperation: ServiceOrOperationEntity) {
      this.setState({ serviceOrOperation });
      this.props.form.setFieldsValue({ serviceOrOperation });
    }


    onLookbackChange(lookback: string) {
      this.setState({ lookback });
    }


    onDateRangeChanged(dateRange: any) {
      this.setState({ dateRange });
    }


    onStartTimeChanged(startTime: any) {
      this.setState({ startTime });
    }


    onEndTimeChanged(finishTime: any) {
      this.setState({ finishTime });
    }


    onLimitChange(limit: number | undefined) {
      // if (_.isNumber(limit))
      this.setState({ limit });
    }


    onTagRemove(removedTag: string) {
      const tags = this.state.tagItems.filter(tag => tag !== removedTag);
      this.setState({ tags });
    }


    showTagInput() {
      this.setState({ tagInputVisible: true }, () => this.tagInputRef.focus());
    }


    saveTagInputRef(input: any) {
      this.tagInputRef = input;
    }


    onTagInputChange(e: any) {
      this.setState({ tagInputValue: e.target.value });
    }


    onTagInputConfirm() {
      const { tagInputValue } = this.state;
      let { tagItems } = this.state;
      if (tagInputValue && tagItems.indexOf(tagInputValue) === -1) {
        tagItems = [...tagItems, tagInputValue];
      }
      this.setState({
        tagItems,
        tagInputVisible: false,
        tagInputValue: '',
      });
    }


    onMinDurationChange(e: any) {
      this.setState({ minDuration: e.target.value });
    }


    onMaxDurationChange(e: any) {
      this.setState({ maxDuration: e.target.value });
    }


    onClear() {
      const data = {
        lookback: '1h',
        limit: 20,
        serviceOrOperation: null,
        dateRange: null,
        startTime: null,
        finishTime: null,
      };
      this.setState(data);
      this.props.form.setFieldsValue(data);
    }


    onSearch() {
      this.props.form.validateFields((err: any, values: any) => {
        if (err) return;
        const query = this.toQuery();
        this.props.onSearch(query);
      });
    }


    isJsonDataSourceSelected() {
      return this.state.dataSource ?
        (this.state.dataSource.type === DataSourceType.JAEGER_JSON) || (this.state.dataSource.type === DataSourceType.ZIPKIN_JSON) :
        false;
    }


    toQuery(): SearchQuery {
      if (!this.state.dataSource) throw new Error('Data source must be set');

      let start: number;
      let finish: number;

      if (this.state.lookback === 'custom') {
        if (!(this.state.dateRange && this.state.dateRange[0] && this.state.dateRange[1] &&
          this.state.startTime && this.state.finishTime)) {
          throw new Error('Date range & times must be set');
        }

        const startDate = this.state.dateRange[0];
        startDate.hour(this.state.startTime.hour());
        startDate.minute(this.state.startTime.minute());
        startDate.second(0);
        startDate.millisecond(0);
        start = startDate.valueOf();

        const finishDate = this.state.dateRange[1];
        finishDate.hour(this.state.finishTime.hour());
        finishDate.minute(this.state.finishTime.minute());
        finishDate.second(59);
        finishDate.millisecond(999);
        finish = finishDate.valueOf();
      } else {
        finish = Date.now();
        const lookbackInMs = parse(this.state.lookback);
        start = finish - lookbackInMs;
      }

      const tags = this.state.tagItems.map((rawTag) => {
        const parts = rawTag.split('=');
        if (parts.length === 1) return rawTag;
        const remainer = rawTag.replace(`${parts[0]}=`, '');
        return { [parts[0]]: remainer };
      });

      let minDuration: any;
      if (this.state.minDuration) {
        const parsed = parse(this.state.minDuration);
        if (parsed > 0) minDuration = parsed;
      }

      let maxDuration: any;
      if (this.state.maxDuration) {
        const parsed = parse(this.state.maxDuration);
        if (parsed > 0) maxDuration = parsed;
      }

      return {
        dataSource: this.state.dataSource,
        serviceName: this.state.serviceOrOperation && this.state.serviceOrOperation.service,
        operationName: this.state.serviceOrOperation && this.state.serviceOrOperation.operation,
        startTime: start,
        finishTime: finish,
        tags,
        minDuration,
        maxDuration,
        limit: this.state.limit
      };
    }


    render() {
      const { getFieldDecorator } = this.props.form;

      return (
        <Form layout="horizontal" className="search-form">
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item label="Data Source">
                {getFieldDecorator(`dataSource`, {
                  rules: [{ required: true, message: 'Please select a data source!' }],
                })(
                  <DataSourceSelect
                    style={{ width: '100%' }}
                    onChange={this.binded.onDataSourceChange}
                    hideJsonFiles={false}
                  />
                )}
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item label="Service/Operation">
                {getFieldDecorator(`serviceOrOperation`, {
                  rules: [{ required: !this.binded.isJsonDataSourceSelected(), message: 'Please select a service or an operation!' }],
                })(
                  <ServiceOrOperationSelect
                    style={{ width: '100%' }}
                    api={this.state.dataSource ? DataSourceManager.getSingleton().apiFor(this.state.dataSource as any) : null as any}
                    onChange={this.binded.onServiceOrOperationChange}
                    disabled={this.binded.isJsonDataSourceSelected()}
                  />
                )}
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item label="Lookback">
                {getFieldDecorator(`lookback`, {
                  initialValue: '1h',
                  rules: [{ required: true, message: 'Please select lookback!' }],
                })(
                  <Select
                    style={{ width: '100%' }}
                    onChange={this.binded.onLookbackChange}
                    disabled={this.binded.isJsonDataSourceSelected()}
                  >
                    <Option value="1h">Last Hour</Option>
                    <Option value="2h">Last 2 Hours</Option>
                    <Option value="3h">Last 3 Hours</Option>
                    <Option value="6h">Last 6 Hours</Option>
                    <Option value="12h">Last 12 Hours</Option>
                    <Option value="24h">Last 24 Hours</Option>
                    <Option value="2d">Last 2 Days</Option>
                    <Option value="7d">Last 7 Days</Option>
                    <Option value="custom">Custom</Option>
                  </Select>
                )}
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label={this.state.dataSource && this.state.dataSource.type == DataSourceType.JAEGER ? (
                  <span>
                    Tags&nbsp;
                    <Popover
                      title={(
                        <>Values should be in the <a href="https://brandur.org/logfmt" target="_blank">logfmt</a> format.</>
                      )}
                      content={(
                        <>
                          <ul>
                            <li>Use seperate tags for conjunctions</li>
                            <li>Values containing whitespace should be enclosed in quotes</li>
                          </ul>
                          <Text code>error=true</Text>
                          <Text code>db.statement="select * from User"</Text>
                        </>
                      )}
                    >
                      <Icon type="question-circle-o" />
                    </Popover>
                  </span>
                ) : this.state.dataSource && this.state.dataSource.type == DataSourceType.ZIPKIN ? (
                  <span>
                    Annotation Query&nbsp;
                    <Popover
                      content={(
                        <>
                          <ul>
                            <li>Use seperate tags for "and" conjunctions</li>
                          </ul>
                          <Text code>http.path=/foo/bar/</Text>
                          <Text code>cluster=foo</Text>
                          <Text code>cache.miss</Text>
                        </>
                      )}
                    >
                      <Icon type="question-circle-o" />
                    </Popover>
                  </span>
                ) : <span>Tags/Annotations</span>}
              >
                <div
                  className={this.binded.isJsonDataSourceSelected() ? 'ant-input-disabled' : ''}
                  style={{ border: '1px solid #d9d9d9', borderRadius: 4, lineHeight: '25px', padding: '3px 5px 5px 5px', marginTop: 3 }}
                >
                  {this.binded.isJsonDataSourceSelected() && (
                    <span>Tag searching is not supported for JSON files</span>
                  )}
                  {!this.binded.isJsonDataSourceSelected() && this.state.tagItems.map((tag, index) => {
                    const isLongTag = tag.length > 20;
                    const tagElem = (
                      <Tag key={tag} closable={true} onClose={() => this.binded.onTagRemove(tag)}>
                        {isLongTag ? `${tag.slice(0, 20)}...` : tag}
                      </Tag>
                    );
                    return isLongTag ? (
                      <Tooltip title={tag} key={tag}>
                        {tagElem}
                      </Tooltip>
                    ) : (
                      tagElem
                    );
                  })}
                  {!this.binded.isJsonDataSourceSelected() && this.state.tagInputVisible && (
                    <Input
                      ref={this.binded.saveTagInputRef}
                      type="text"
                      size="small"
                      style={{ width: 78 }}
                      value={this.state.tagInputValue}
                      onChange={this.binded.onTagInputChange}
                      onBlur={this.binded.onTagInputConfirm}
                      onPressEnter={this.binded.onTagInputConfirm}
                    />
                  )}
                  {!this.binded.isJsonDataSourceSelected() && !this.state.tagInputVisible && (
                    <Tag onClick={this.binded.showTagInput} style={{ background: '#fff', borderStyle: 'dashed' }}>
                      <Icon type="plus" /> Add Tag
                    </Tag>
                  )}
                </div>
              </Form.Item>
            </Col>

            <Col span={12}>
              {!this.binded.isJsonDataSourceSelected() && this.state.lookback === 'custom' ? (
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item label="Date Range">
                      {getFieldDecorator(`dateRange`, {
                        rules: [{ required: true, message: 'Please select a date range!' }],
                      })(
                        <RangePicker
                          style={{ width: '100%' }}
                          onChange={this.binded.onDateRangeChanged}
                          disabled={this.binded.isJsonDataSourceSelected()}
                        />
                      )}
                    </Form.Item>
                  </Col>

                  <Col span={6}>
                    <Form.Item label="Start time">
                      {getFieldDecorator(`startTime`, {
                        initialValue: moment('00:00:00', timeFormat),
                        rules: [{ required: true, message: 'Please set a start time!' }],
                      })(
                        <TimePicker
                          style={{ width: '100%' }}
                          format={timeFormat}
                          onChange={this.binded.onStartTimeChanged}
                          disabled={this.binded.isJsonDataSourceSelected()}
                        />
                      )}
                    </Form.Item>
                  </Col>

                  <Col span={6}>
                    <Form.Item label="End time">
                      {getFieldDecorator(`endTime`, {
                        initialValue: moment('23:59:59', timeFormat),
                        rules: [{ required: true, message: 'Please set a end time!' }],
                      })(
                        <TimePicker
                          style={{ width: '100%' }}
                          format={timeFormat}
                          onChange={this.binded.onEndTimeChanged}
                          disabled={this.binded.isJsonDataSourceSelected()}
                        />
                      )}
                    </Form.Item>
                  </Col>
                </Row>
              ): null}

              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item label="Min Duration">
                    {getFieldDecorator(`minDuration`, {
                      rules: [{ validator: validateDuration, message: 'Cannot parse duration!' }],
                    })(
                      <Input
                        style={{ width: '100%' }}
                        placeholder="500ms"
                        onChange={this.binded.onMinDurationChange}
                        disabled={this.binded.isJsonDataSourceSelected()}
                      />
                    )}
                  </Form.Item>
                </Col>

                <Col span={8}>
                  <Form.Item label="Max Duration">
                    {getFieldDecorator(`maxDuration`, {
                      rules: [{ validator: validateDuration, message: 'Cannot parse duration!' }],
                    })(
                      <Input
                        style={{ width: '100%' }}
                        placeholder="15.5s"
                        onChange={this.binded.onMaxDurationChange}
                        disabled={this.binded.isJsonDataSourceSelected()}
                      />
                    )}
                  </Form.Item>
                </Col>

                <Col span={8}>
                  <Form.Item label="Limit">
                    {getFieldDecorator(`limit`, {
                      initialValue: 20,
                      rules: [{ required: true, message: 'Please enter a valid number!' }],
                    })(
                      <InputNumber
                        style={{ width: '100%' }}
                        min={1}
                        max={100}
                        onChange={this.binded.onLimitChange}
                        disabled={this.binded.isJsonDataSourceSelected()}
                      />
                    )}
                  </Form.Item>
                </Col>
              </Row>
            </Col>
          </Row>

          <Row>
            <Col span={24} style={{ textAlign: 'right' }}>
              <Button type="primary" icon="search" htmlType="submit" onClick={this.binded.onSearch}>
                Search
              </Button>
              <Button style={{ marginLeft: 8 }} onClick={this.binded.onClear}>
                Clear
              </Button>
            </Col>
          </Row>
        </Form>
      );
    }
  }
);


function validateDuration(rule: never, value: string, callback: (err?: string) => void) {
  if (!value) return callback();
  try {
    const parsedDuration = parse(value);
    if (parsedDuration > 0) {
      callback();
    } else {
      callback('Cannot parse duration');
    }
  } catch (err) {
    console.error('Could not parse duration', err);
    callback('Cannot parse duration');
  }
}


export default SearchForm;
