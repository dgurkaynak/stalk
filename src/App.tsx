import React from 'react';
import { Layout, Menu, Icon } from 'antd';
import { BrowserRouter as Router, Route, Link } from 'react-router-dom';
import './app.css';

const { Content, Footer, Sider } = Layout;

const Datasources: React.FC = () => <div>data sources</div>;
const Search: React.FC = () => <div>search</div>;
const Timeline: React.FC = () => <div>timeline</div>;
const Settings: React.FC = () => <div>settings</div>;

const App: React.FC = () => {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider className="app-sider" trigger={null} collapsible collapsed={true}>
          <div className="logo" />
          <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline">
            <Menu.Item key="1">
              <Icon type="database" />
              <span>Data Sources</span>
              <Link to="/datasources" />
            </Menu.Item>
            <Menu.Item key="2">
              <Icon type="search" />
              <span>Search</span>
              <Link to="/search" />
            </Menu.Item>
            <Menu.Item key="3">
              <Icon type="line-chart" />
              <span>Timeline View</span>
              <Link to="/timeline" />
            </Menu.Item>
            <Menu.Item key="4">
              <Icon type="setting" />
              <span>Settings</span>
              <Link to="/settings" />
            </Menu.Item>
          </Menu>
        </Sider>
        <Layout>
          {/* <Header style={{ background: '#fff', padding: 0 }} /> */}
          <Content style={{ margin: '0 16px' }}>
            <Route exact path="/" component={Datasources} />
            <Route path="/datasources" component={Datasources} />
            <Route path="/search" component={Search} />
            <Route path="/timeline" component={Timeline} />
            <Route path="/settings" component={Settings} />
          </Content>
          <Footer style={{ textAlign: 'center' }}>Ant Design ©2018 Created by Ant UED</Footer>
        </Layout>
      </Layout>
    </Router>
  );
}


export default App;
