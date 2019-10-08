import React from 'react';
import { Button, Modal, Upload, Icon } from 'antd';
import { UploadFile, UploadChangeParam } from 'antd/lib/upload/interface';
import { DataSource, DataSourceType } from '../../model/datasource/interfaces';
import { isJaegerJSON } from '../../model/api/jaeger/span';
import { isZipkinJSON } from '../../model/api/zipkin/span';
import shortid from 'shortid';

const { Dragger } = Upload;


export interface DataSourceImportJsonModalProps {
  visible: boolean,
  onImport: (datasources: DataSource[]) => void,
  onCancel: () => void,
}


export class DataSourceImportJsonModal extends React.Component<DataSourceImportJsonModalProps> {
  state = {
    dataSources: [] as DataSource[]
  };
  binded = {
    onDraggerCustomRequest: this.onDraggerCustomRequest.bind(this),
    onDraggerChange: this.onDraggerChange.bind(this),
    onImport: this.onImport.bind(this),
    onCancel: this.onCancel.bind(this),
  };


  onDraggerCustomRequest(option: any) {
    const file = option.file as File;
    const fileReader = new FileReader();

    fileReader.onerror = () => {
      option.onError(fileReader.error);
    };

    fileReader.onload = (e) => {
      // Parse json
      let jsonObject: any;
      try {
        jsonObject = JSON.parse(fileReader.result as string);
      } catch (err) {
        // TODO: Show error with file name
        option.onError(new Error('Invalid JSON'));
        return;
      }

      const isJaeger = isJaegerJSON(jsonObject);
      const isZipkin = isZipkinJSON(jsonObject);

      if (!isJaeger && !isZipkin) {
        // TODO: Show error with file name
        option.onError(new Error('Unrecognized Jaeger/Zipkin JSON'));
        return;
      }

      const type = isJaeger ? DataSourceType.JAEGER_JSON :
        isZipkin ? DataSourceType.ZIPKIN_JSON :
        null;

      if (!type) {
        // TODO: Show error with file name
        option.onError(new Error('Unrecognized Jaeger/Zipkin JSON'));
        return;
      }

      // Create new datasource and add it
      const dataSource: DataSource = {
        id: shortid.generate(),
        name: file.name,
        type: type,
        data: jsonObject
      };

      // Hack alert #1
      (file as any).dataSourceId = dataSource.id;
      this.setState({
        dataSources: [...this.state.dataSources, dataSource]
      });

      option.onSuccess();
    }

    fileReader.readAsText(file);
  }


  onDraggerChange(info: UploadChangeParam<UploadFile>) {
    if (info.file.status === 'removed') {
      const file = info.file.originFileObj;
      // Hack alert #1
      const dsId = (file as any).dataSourceId as string;
      this.setState({
        dataSources: this.state.dataSources.filter(ds => ds.id !== dsId)
      });
    }
  }


  onImport() {
    const dataSources = this.state.dataSources;
    this.props.onImport(dataSources);
    this.setState({ dataSources: [] });
  }


  onCancel() {
    this.props.onCancel();
    this.setState({ dataSources: [] });
  }


  render() {
    const { visible } = this.props;
    return (
      <Modal
        visible={visible}
        destroyOnClose={true}
        title="Import JSON"
        onOk={this.binded.onImport}
        onCancel={this.binded.onCancel}
        footer={[
          <Button key="submit" type="primary" onClick={this.binded.onImport}>
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
