import React from 'react';
import { PageHeader } from 'antd';
import DataSourceManager from '../datasource/manager';
import DataSourceSelect from '../datasource/select';
import { DataSourceEntity } from '../datasource/interfaces';
import { ServiceOrOperationSelect, ServiceOrOperationEntity } from './service-or-operation-select';


export interface SearchScreenProps {
  visible: boolean
}


export class SearchScreen extends React.Component<SearchScreenProps> {
  state = {
    // Do not auto-select first one, ServiceOrOperation component acts wierdly
    dataSource: null, // DataSourceManager.getAll()[0],
    serviceOrOperation: null
  };
  binded = {
    onDataSourceChange: this.onDataSourceChange.bind(this),
    onServiceOrOperationChange: this.onServiceOrOperationChange.bind(this)
  };


  onDataSourceChange(dataSource: DataSourceEntity) {
    this.setState({ dataSource });
  }


  onServiceOrOperationChange(serviceOrOperation: ServiceOrOperationEntity) {
    this.setState({ serviceOrOperation });
  }


  render() {
    const { visible } = this.props;

    return (
      <div style={{ display: visible ? 'block' : 'none' }}>
        <PageHeader
          className="pageheader-with-button"
          backIcon={false}
          title="Search Traces"
        ></PageHeader>

        <div style={{ background: '#fff', margin: 24, borderRadius: 3 }}>
          <DataSourceSelect
            style={{ width: 200 }}
            value={this.state.dataSource as any}
            onChange={this.binded.onDataSourceChange}
          />

          <ServiceOrOperationSelect
            style={{ width: 200 }}
            api={this.state.dataSource ? DataSourceManager.apiFor(this.state.dataSource as any) : null as any}
            onChange={this.binded.onServiceOrOperationChange}
            value={this.state.serviceOrOperation as any}
          />
        </div>


      </div>
    );
  }
}


export default SearchScreen;
