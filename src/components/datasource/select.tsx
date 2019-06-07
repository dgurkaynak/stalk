import React from 'react';
import { Select } from 'antd';
import DataSourceManager from '../../model/datasource/manager';
import { DataSource } from '../../model/datasource/interfaces';

const { Option } = Select;


export interface DataSourceSelectProps {
  style?: React.CSSProperties,
  onChange: (dataSource: DataSource) => void,
  value?: DataSource
}


export class DataSourceSelect extends React.Component<DataSourceSelectProps> {
  private dsManager = DataSourceManager.getSingleton();
  state = {
    dataSources: this.dsManager.getAll()
  };
  binded = {
    onChange: this.onChange.bind(this)
  };


  onChange(value: any) {
    this.props.onChange(this.dsManager.get(value)!);
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
