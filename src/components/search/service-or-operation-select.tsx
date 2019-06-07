import React from 'react';
import { TreeSelect } from 'antd';
import JaegerAPI from '../../model/jaeger/api';
import ZipkinAPI from '../../model/zipkin/api';



export enum ServiceOrOperationType {
  SERVICE = 'service',
  OPERATION = 'operation'
}


export interface ServiceOrOperationEntity {
  type: ServiceOrOperationType | string,
  service: string,
  operation: string
}


export interface ServiceOrOperationSelectProps {
  style?: React.CSSProperties,
  api?: JaegerAPI | ZipkinAPI,
  onChange: (serviceOrOperation: ServiceOrOperationEntity) => void,
  value?: ServiceOrOperationEntity
}


export class ServiceOrOperationSelect extends React.Component<ServiceOrOperationSelectProps> {
  state = {
    treeData: this.props.api ? convertServicesAndOperationsToTreeData(this.props.api.getServicesAndOperations()) : []
  };
  binded = {
    onChange: this.onChange.bind(this)
  };


  componentWillReceiveProps(nextProps: any) {
    if (this.props.api !== nextProps.api) {
      this.setState({
        treeData: convertServicesAndOperationsToTreeData(nextProps.api.getServicesAndOperations())
      });
    }
  }


  onChange(value: any) {
    this.props.onChange(convertSelectKeyToServiceOrOperationEntity(value));
  }


  render() {
    const conditionalProps = this.props.value ? {
      value: buildSelectKey(this.props.value.service, this.props.value.operation)
    } : {};

    return (
      <TreeSelect
        showSearch
        style={this.props.style || {}}
        {...conditionalProps}
        // dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
        treeData={this.state.treeData}
        placeholder="Select a service or an operation"
        onChange={this.binded.onChange}
        treeDefaultExpandAll
      />
    );
  }
}


function buildSelectKey(service: string, operation?: string) {
  const type = operation ? 'operation' : 'service';
  return JSON.stringify({ type, service, operation });
}


function convertServicesAndOperationsToTreeData(serviceAndOperations: { [key: string]: string[] }) {
  return Object.keys(serviceAndOperations).map((service: string) => {
    const operations = serviceAndOperations[service];
    const children = operations.map((operation) => ({
      title: operation,
      value: buildSelectKey(service, operation),
      key: buildSelectKey(service, operation)
    }));

    return {
      title: service,
      value: buildSelectKey(service),
      key: buildSelectKey(service),
      children
    };
  });
}


function convertSelectKeyToServiceOrOperationEntity(key: string) {
  return JSON.parse(key);
}


export default ServiceOrOperationSelect;
