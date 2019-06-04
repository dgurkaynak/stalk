import React from 'react';
import { Layout, Menu, Breadcrumb, Icon } from 'antd';
import './App.css';

const { Content, Footer, Sider } = Layout;



const App: React.FC = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
    <Sider className="app-sider" trigger={null} collapsible collapsed={true}>
      <div className="logo" />
      <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline">
        <Menu.Item key="1">
          <Icon type="database" />
          <span>Data Sources</span>
        </Menu.Item>
        <Menu.Item key="2">
          <Icon type="search" />
          <span>Search</span>
        </Menu.Item>
        <Menu.Item key="3">
          <Icon type="line-chart" />
          <span>Timeline View</span>
        </Menu.Item>
        <Menu.Item key="4">
          <Icon type="setting" />
          <span>Settings</span>
        </Menu.Item>
      </Menu>
    </Sider>
    <Layout>
      {/* <Header style={{ background: '#fff', padding: 0 }} /> */}
      <Content style={{ margin: '0 16px' }}>
        <Breadcrumb style={{ margin: '16px 0' }}>
          <Breadcrumb.Item>User</Breadcrumb.Item>
          <Breadcrumb.Item>Bill</Breadcrumb.Item>
        </Breadcrumb>
        <div style={{ padding: 24, background: '#fff', minHeight: 360 }}>Bill is a cat.</div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>Ant Design ©2018 Created by Ant UED</Footer>
    </Layout>
  </Layout>
  );
}


export default App;
