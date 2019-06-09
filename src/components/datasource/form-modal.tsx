import React from 'react';
import { Button, Modal, Form, Input, Select, Collapse, message } from 'antd';
import JaegerAPI from '../../model/api/jaeger/api';
import ZipkinAPI from '../../model/api/zipkin/api';
import { DataSourceType, DataSource } from '../../model/datasource/interfaces'
import * as shortid from 'shortid';
import * as _ from 'lodash';

const { Option } = Select;
const { Panel } = Collapse;


const styles = {
  formItem: {
    marginBottom: 16
  },
  formItemInput: {
    width: '100%'
  },
  basicAuthPanel: {
    background: '#f7f7f7',
    borderRadius: 4,
    marginBottom: 0,
    border: 0,
    overflow: 'hidden'
  }
};

const formItemProps = {
  labelCol: { span: 6 },
  wrapperCol: { span: 16 },
  style: styles.formItem
};


export interface DataSourceFormModalProps {
  visible: boolean,
  onSave: (dataSource: DataSource, isNew: boolean) => void,
  onCancel: () => void,
  form: any,
  dataSource?: DataSource
}


export const DataSourceFormModal: any = Form.create({
  name: 'datasource-form-modal',
  mapPropsToFields: (props: any) => _.mapValues(props.dataSource || {}, (value) => Form.createFormField({ value }))
})(
  class extends React.Component<DataSourceFormModalProps> {
    state = {
      isTesting: false
    };
    binded = {
      onTest: this.onTest.bind(this),
      onSave: this.onSave.bind(this)
    };


    onTest() {
      this.props.form.validateFields(async (err: Error, values: any) => {
        if (err) return;

        this.setState({ isTesting: true });

        switch (values.type) {
          case DataSourceType.JAEGER:
          case DataSourceType.ZIPKIN: {
            const options = {
              baseUrl: values.baseUrl,
              username: values.username,
              password: values.password
            };

            try {
              const api = values.type === DataSourceType.JAEGER ? new JaegerAPI(options) : new ZipkinAPI(options);
              await api.test();
              message.success(`Data source is working`);
            } catch (err) {
              message.error(`Data source error: "${err.message}"`);
            }

            break;
          }

          default: {
            message.error(`Unsupported data source type "${values.type}"`);
          }
        }

        this.setState({ isTesting: false });
      });
    }
//form.resetFields();


    onSave() {
      this.props.form.validateFields(async (err: Error, values: any) => {
        if (err) return;

        this.props.onSave({
          id: (this.props.dataSource && this.props.dataSource.id) || shortid.generate(),
          type: values.type,
          name: values.name,
          baseUrl: values.baseUrl,
          username: values.username,
          password: values.password
        }, !this.props.dataSource);
      });
    }

    render() {
      const { visible, onCancel, form, dataSource } = this.props;
      const { isTesting } = this.state;
      const { getFieldDecorator } = form;

      return (
        <Modal
          visible={visible}
          destroyOnClose={true}
          title={dataSource ? 'Update data source' : 'Create a data source'}
          onCancel={onCancel}
          onOk={this.binded.onSave}
          footer={[
            <Button key="test" type="default" loading={isTesting} onClick={this.binded.onTest}>
              Test
            </Button>,
            <Button key="submit" type="primary" onClick={this.binded.onSave}>
              Save
            </Button>
          ]}
        >
          <Form layout="horizontal">
            <Form.Item label="Type" {...formItemProps}>
              {getFieldDecorator('type', { initialValue: 'jaeger' })(
                <Select style={{ width: 120 }} disabled={!!dataSource}>
                  <Option value={DataSourceType.JAEGER}>Jaeger</Option>
                  <Option value={DataSourceType.ZIPKIN}>Zipkin</Option>
                </Select>
              )}
            </Form.Item>
            <Form.Item label="Name" {...formItemProps}>
              {getFieldDecorator('name', {
                rules: [{ required: true, whitespace: true, message: 'Please enter a friendly name' }],
              })(<Input style={styles.formItemInput} placeholder="My data source" />)}
            </Form.Item>
            <Form.Item label="API Base URL" {...formItemProps}>
              {getFieldDecorator('baseUrl', {
                rules: [{ required: true, whitespace: true, message: 'Please enter a valid HTTP/HTTPS url' }],
              })(
              <Input style={styles.formItemInput} placeholder="http://localhost:16686" />
              )}
            </Form.Item>
            <Collapse bordered={false} defaultActiveKey={[]}>
              <Panel header="Basic Authentication" key="1" style={styles.basicAuthPanel}>
                <Form.Item label="Username" {...formItemProps}>
                  {getFieldDecorator('username')(<Input style={styles.formItemInput} />)}
                </Form.Item>
                <Form.Item label="Password" {...formItemProps}>
                  {getFieldDecorator('password')(<Input.Password style={styles.formItemInput} />)}
                </Form.Item>
              </Panel>
            </Collapse>
          </Form>
        </Modal>
      );
    }
  }
);

export default DataSourceFormModal;
