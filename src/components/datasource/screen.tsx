import React from 'react';
import { Button, PageHeader } from 'antd';
import DataSourceFormModal from './form-modal'
import DataSourceImportJsonModal from './import-json-modal'
import { DataSource } from '../../model/datasource/interfaces';
import DataSourceManager, { DataSourceManagerEvent } from '../../model/datasource/manager';
import DataSourceList from './list';


export interface DataSourcesScreenProps {
  visible: boolean
}


export class DataSourcesScreen extends React.Component<DataSourcesScreenProps> {
  private dsManager = DataSourceManager.getSingleton();
  state = {
    dataSources: this.dsManager.getAll(),
    isImportJsonModalVisible: false,
    isFormModalVisible: false,
    formModalDataSource: null
  };
  binded = {
    onJsonImported: this.onJsonImported.bind(this),
    onFormModalSave: this.onFormModalSave.bind(this),
    onDataSourceClick: this.onDataSourceClick.bind(this),
    onDataSourceDelete: this.onDataSourceDelete.bind(this),
    onDataSourceManagerUpdated: this.onDataSourceManagerUpdated.bind(this),
  };


  componentDidMount() {
    this.dsManager.on(DataSourceManagerEvent.UPDATED, this.binded.onDataSourceManagerUpdated);
  }


  componentWillUnmount() {
    this.dsManager.removeListener(DataSourceManagerEvent.UPDATED, this.binded.onDataSourceManagerUpdated);
  }


  onDataSourceManagerUpdated() {
    this.setState({ dataSources: this.dsManager.getAll() });
  }


  async onJsonImported(dataSources: DataSource[]) {
    this.setState({ isImportJsonModalVisible: false });

    const tasks = dataSources.map(async (ds) => {
      try {
        await this.dsManager.add(ds);
      } catch (err) {
        // TODO: Show error
        console.error('Could not add datasource', err);
      }
    });

    await Promise.all(tasks);
  }


  async onFormModalSave(dataSource: DataSource, isNew: boolean) {
    if (isNew) {
      await this.dsManager.add(dataSource);
    } else {
      await this.dsManager.update(dataSource);
    }
    this.setState({
      dataSources: this.dsManager.getAll(),
      isFormModalVisible: false,
      formModalDataSource: null
    });
  }


  onDataSourceClick(dataSource: DataSource) {
    this.setState({
      isFormModalVisible: true,
      formModalDataSource: dataSource
    });
  }


  async onDataSourceDelete(dataSource: DataSource) {
    await this.dsManager.remove(dataSource);
    this.setState({ dataSources: this.dsManager.getAll() });
  }


  render() {
    return (
      <div style={{ display: this.props.visible ? 'block' : 'none', overflow: 'auto', height: '100vh' }}>
        <PageHeader
          className="pageheader-with-button"
          backIcon={false}
          title="Data Sources"
          style={{ background: '#fff' }}
          extra={[
            <Button
              key="1"
              type="default"
              icon="import"
              onClick={() => this.setState({ isImportJsonModalVisible: true })}
            >
              Import JSON
            </Button>,
            <Button
              key="2"
              type="primary"
              icon="plus"
              onClick={() => this.setState({ formModalDataSource: null, isFormModalVisible: true })}
            >
              Create New
            </Button>,
          ]}
        ></PageHeader>

        <DataSourceImportJsonModal
          visible={this.state.isImportJsonModalVisible}
          onImport={this.binded.onJsonImported}
          onCancel={() => this.setState({isImportJsonModalVisible: false})}
        />

        <DataSourceFormModal
          visible={this.state.isFormModalVisible}
          onCancel={() => this.setState({ isFormModalVisible: false, formModalDataSource: null })}
          onSave={this.binded.onFormModalSave}
          dataSource={this.state.formModalDataSource}
        />

        <div style={{ background: '#fff', margin: 24, borderRadius: 3 }}>
          <DataSourceList
            dataSources={this.state.dataSources}
            onItemNameClick={this.binded.onDataSourceClick}
            onItemDelete={this.binded.onDataSourceDelete}
          />
        </div>
      </div>
    );
  }
}


export default DataSourcesScreen;
