import React from 'react';
import { Button, PageHeader, Empty, Modal, Upload, Icon } from 'antd';

const { Dragger } = Upload;


export class Datasources extends React.Component {
  state = {
    isImportJsonModalVisible: false
  };


  onImportJsonButtonClicked() {
    console.log('this.state', this.state);
  }


  render() {
    return (
      <>
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
            <Button key="2" type="primary" icon="plus">
              Create New
            </Button>,
          ]}
        ></PageHeader>

        <Modal
          visible={this.state.isImportJsonModalVisible}
          title="Import JSON"
          onOk={this.onImportJsonButtonClicked.bind(this)}
          onCancel={() => this.setState({ isImportJsonModalVisible: false })}
          footer={[
            <Button key="submit" type="primary" onClick={this.onImportJsonButtonClicked.bind(this)}>
              Import
            </Button>,
          ]}
        >
          <Dragger
            accept=".json,application/json"
            multiple={true}
            customRequest={(option) => {
              console.log('custom request', option);
              setTimeout(() => {
                option.onSuccess();
                // option.onError(new Error('Not valid JSON'));
              }, 1000);
            }}
            onChange={(info) => {
              const status = info.file.status;
              if (status !== 'uploading') {
                console.log(info.file, info.fileList);
              }
              if (status === 'done') {
                console.log(`${info.file.name} file uploaded successfully.`);
              } else if (status === 'error') {
                console.log(`${info.file.name} file upload failed.`);
              }
            }}
          >
            <p className="ant-upload-drag-icon">
              <Icon type="inbox" />
            </p>
            <p className="ant-upload-text">Click or drag files to this area</p>
            <p className="ant-upload-hint" style={{ padding: 5 }}>
              You can add multiple JSON files that are exported from Jaeger or Zipkin.
            </p>
          </Dragger>
        </Modal>

        <div style={{ background: '#fff', margin: 24, borderRadius: 3 }}>
          <Empty description="No data sources yet" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 24 }} />
        </div>
      </>
    );
  }
}


export default Datasources;
