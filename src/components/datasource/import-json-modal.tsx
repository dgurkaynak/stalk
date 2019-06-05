import React from 'react';
import { Button, Modal, Upload, Icon } from 'antd';
import { UploadFile, UploadChangeParam } from 'antd/lib/upload/interface';

const { Dragger } = Upload;


export interface DataSourceImportJsonModalProps {
  visible: boolean,
  onImport: (datasources: any) => void,
  onCancel: () => void,
}


export class DataSourceImportJsonModal extends React.Component<DataSourceImportJsonModalProps> {
  state = {
    dataSources: [] as any[]
  };
  binded = {
    onDraggerCustomRequest: this.onDraggerCustomRequest.bind(this),
    onDraggerChange: this.onDraggerChange.bind(this)
  };


  onDraggerCustomRequest(option: any) {
    console.log('custom request', option);
    setTimeout(() => {
      option.onSuccess();
      this.setState({
        dataSources: [
          ...this.state.dataSources,
          null // TODO: Add datasource
        ]
      });
      // option.onError(new Error('Not valid JSON'));
    }, 1000);
  }


  onDraggerChange(info: UploadChangeParam<UploadFile>) {
    const status = info.file.status;
    if (status !== 'uploading') {
      console.log(info.file, info.fileList);
    }
    if (status === 'done') {
      info.fileList[0].name = `${info.fileList[0].name} — Zipkin: 4 trace(s), 26 span(s)`
      console.log(`${info.file.name} file uploaded successfully.`);
    } else if (status === 'error') {
      console.log(`${info.file.name} file upload failed.`);
    }
  }


  render() {
    const { visible, onImport, onCancel } = this.props;
    return (
      <Modal
        visible={visible}
        destroyOnClose={true}
        title="Import JSON"
        onOk={onImport}
        onCancel={onCancel}
        footer={[
          <Button key="submit" type="primary" onClick={() => onImport(this.state.dataSources)}>
            Import {this.state.dataSources.length} data source(s)
          </Button>,
        ]}
      >
        <Dragger
          accept=".json,application/json"
          multiple={true}
          customRequest={this.binded.onDraggerCustomRequest}
          onChange={this.binded.onDraggerChange}
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
    );
  }
}


export default DataSourceImportJsonModal;
