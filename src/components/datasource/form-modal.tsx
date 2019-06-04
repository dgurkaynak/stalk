import React from 'react';
import { Button, Modal, Form, Input, Select, Collapse } from 'antd';

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
  onSubmit: () => void,
  onCancel: () => void,
  form: any
}


export const DataSourceFormModal: any = Form.create({ name: 'datasource-form-modal' })(
  class extends React.Component<DataSourceFormModalProps> {
    state = {
      isTesting: false
    };
    binded = {
      onTest: this.onTest.bind(this)
    };


    onTest() {
      this.setState({ isTesting: true });

      this.props.form.validateFields((err: Error, values: any[]) => {
        if (err) {
          this.setState({ isTesting: false });
          return;
        }

        // TODO: Make a http request!
        // this.setState({ isTesting: false });
      });
    }
//form.resetFields();

    render() {
      const { visible, onCancel, onSubmit, form } = this.props;
      const { isTesting } = this.state;
      const { getFieldDecorator } = form;

      return (
        <Modal
          visible={visible}
          title="Create a data source"
          okText="Create"
          onCancel={onCancel}
          onOk={onSubmit}
          footer={[
            <Button key="test" type="default" loading={isTesting} onClick={this.binded.onTest}>
              Test
            </Button>,
            <Button key="submit" type="primary" onClick={onSubmit}>
              Submit
            </Button>
          ]}
        >
          <Form layout="horizontal">
            <Form.Item label="Type" {...formItemProps}>
              {getFieldDecorator('type', { initialValue: 'jaeger' })(
                <Select style={{ width: 120 }}>
                  <Option value="jaeger">Jaeger</Option>
                  <Option value="zipkin">Zipkin</Option>
                </Select>
              )}
            </Form.Item>
            <Form.Item label="Name" {...formItemProps}>
              {getFieldDecorator('name', {
                rules: [{ required: true, whitespace: true, message: 'Please enter a friendly name' }],
              })(<Input style={styles.formItemInput} />)}
            </Form.Item>
            <Form.Item label="API Base URL" {...formItemProps}>
              {getFieldDecorator('baseUrl', {
                rules: [{ required: true, whitespace: true, message: 'Please enter a valid HTTP/HTTPS url' }],
              })(
              <Input style={styles.formItemInput} />
              )}
            </Form.Item>
            <Collapse bordered={false} defaultActiveKey={[]}>
              <Panel header="Basic Authentication" key="1" style={styles.basicAuthPanel}>
                <Form.Item label="Username" {...formItemProps}>
                  {getFieldDecorator('username')(<Input style={styles.formItemInput} />)}
                </Form.Item>
                <Form.Item label="Password" {...formItemProps}>
                  {getFieldDecorator('password')(<Input type="password" style={styles.formItemInput} />)}
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
