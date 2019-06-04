import React from 'react';
import { Button, PageHeader, Empty } from 'antd';
// import DataSourceFormModal from './form-modal'
import DataSourceImportJsonModal from './import-json-modal'


export interface DataSourcesScreenProps {
  visible: boolean
}


export class DataSourcesScreen extends React.Component<DataSourcesScreenProps> {
  formModal: any;
  state = {
    isImportJsonModalVisible: false,
    isFormModalVisible: false
  };
  binded = {
    saveFormModalRef: this.saveFormModalRef.bind(this),
    onJsonImported: this.onJsonImported.bind(this)
  };


  onJsonImported(dataSources: any) {
    console.log('json imported', dataSources);
  }


  saveFormModalRef(ref: any) {
    this.formModal = ref;
  };


  render() {
    const { visible } = this.props;

    return (
      <div style={{ display: visible ? 'block' : 'none' }}>
        <PageHeader
          className="datasources-header"
          backIcon={false}
          title="Data Sources"
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
              onClick={() => this.setState({ isDatasourceFormModalVisible: true })}
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

        {/* <DatasourceFormModal
          wrappedComponentRef={this.binded.saveFormModalRef}
          visible={this.state.isFormModalVisible}
          onCancel={this.handleCancel}
          onCreate={this.handleCreate}
        /> */}

        <div style={{ background: '#fff', margin: 24, borderRadius: 3 }}>
          <Empty description="No data sources yet" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 24 }} />
        </div>
      </div>
    );
  }
}


export default DataSourcesScreen;
