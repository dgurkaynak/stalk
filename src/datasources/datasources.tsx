import React from 'react';
import { Button, PageHeader, Empty, Modal, Upload, Icon, Form, Input, Select, Collapse } from 'antd';

const { Dragger } = Upload;
const { Option } = Select;
const { Panel } = Collapse;


const DatasourceFormModal: any = Form.create({ name: 'datasource-form' })(
  class extends React.Component {
    render() {
      const { visible, onCancel, onCreate, form } = this.props as any;
      const { getFieldDecorator } = form;

      const customFormItemStyle = {
        marginBottom: 16
      };

      const formItemLayout = {
        labelCol: { span: 6 },
        wrapperCol: { span: 16 },
        style: customFormItemStyle
      };

      const customPanelStyle = {
        background: '#f7f7f7',
        borderRadius: 4,
        marginBottom: 0,
        border: 0,
        overflow: 'hidden',
      };

      return (
        <Modal
          visible={visible}
          title="Create a data source"
          okText="Create"
          onCancel={onCancel}
          onOk={onCreate}
          footer={[
            <Button key="test" type="default">
              Test
            </Button>,
            <Button key="submit" type="primary" onClick={onCreate}>
              Submit
            </Button>
          ]}
        >
          <Form layout="horizontal">
            <Form.Item label="Type" {...formItemLayout}>
              {getFieldDecorator('type', { initialValue: 'jaeger' })(
                <Select style={{ width: 120 }}>
                  <Option value="jaeger">Jaeger</Option>
                  <Option value="zipkin">Zipkin</Option>
                </Select>
              )}
            </Form.Item>
            <Form.Item label="Name" {...formItemLayout}>
              {getFieldDecorator('name', {
                rules: [{ required: true, message: 'Please input the title of collection!' }],
              })(<Input style={{ width: '100%' }} />)}
            </Form.Item>
            <Form.Item label="API Base URL" {...formItemLayout}>
              {getFieldDecorator('baseUrl', {
                rules: [{ required: true, message: 'Please input the title of collection!' }],
              })(
              <Input style={{ width: '100%' }} />
              )}
            </Form.Item>
            <Collapse bordered={false} defaultActiveKey={[]}>
              <Panel header="Basic Authentication" key="1" style={customPanelStyle}>
                <Form.Item label="Username" {...formItemLayout}>
                  {getFieldDecorator('username')(<Input style={{ width: '100%' }} />)}
                </Form.Item>
                <Form.Item label="Password" {...formItemLayout}>
                  {getFieldDecorator('password')(<Input type="password" style={{ width: '100%' }} />)}
                </Form.Item>
              </Panel>
            </Collapse>
          </Form>
        </Modal>
      );
    }
  },
);



export class Datasources extends React.Component {
  formRef: any;
  state = {
    isImportJsonModalVisible: false,
    isDatasourceFormModalVisible: false
  };


  onImportJsonButtonClicked() {
    console.log('this.state', this.state);
  }


  handleCancel = () => {
    this.setState({ isDatasourceFormModalVisible: false });
  };


  handleCreate = () => {
    const form = this.formRef.props.form;
    form.validateFields((err: Error, values: any[]) => {
      if (err) {
        return;
      }

      console.log('Received values of form: ', values);
      form.resetFields();
      this.setState({ isDatasourceFormModalVisible: false });
    });
  };


  saveFormRef = (formRef: any) => {
    this.formRef = formRef;
  };


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

        <DatasourceFormModal
          wrappedComponentRef={this.saveFormRef}
          visible={this.state.isDatasourceFormModalVisible}
          onCancel={this.handleCancel}
          onCreate={this.handleCreate}
        />

        <div style={{ background: '#fff', margin: 24, borderRadius: 3 }}>
          <Empty description="No data sources yet" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 24 }} />
        </div>
      </>
    );
  }
}


export default Datasources;
