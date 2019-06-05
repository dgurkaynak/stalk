import React from 'react';
import { Select } from 'antd';
import DataSourceManager from './manager';
import { DataSourceEntity } from './interfaces';

const { Option } = Select;


export interface DataSourceSelectProps {
  style?: React.CSSProperties,
  onChange: (dataSource: DataSourceEntity) => void,
  value?: DataSourceEntity
}


export class DataSourceSelect extends React.Component<DataSourceSelectProps> {
  state = {
    dataSources: DataSourceManager.getAll()
  };
  binded = {
    onChange: this.onChange.bind(this)
  };


  onChange(value: any) {
    this.props.onChange(DataSourceManager.get(value)!);
  }


  render() {
    const conditionalProps = this.props.value ? {value: this.props.value.id} : {};

    return (
      <Select
        showSearch
        {...conditionalProps}
        onChange={this.binded.onChange}
        placeholder="Select a data source"
        style={this.props.style || {}}
      >
        {this.state.dataSources.map((datasource) => (
          <Option key={datasource.id}>{datasource.name}</Option>
        ))}
      </Select>
    );
  }
}


export default DataSourceSelect;
