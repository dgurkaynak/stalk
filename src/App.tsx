import React, { useState, useRef } from 'react';
import { Layout, Menu, Icon } from 'antd';
import DataSourcesScreen from './components/datasource/screen';
import SearchScreen from './components/search/screen';
import TimelineScreen from './components/timeline/screen';
import './App.css';

const { Content, Sider } = Layout;


enum RouteKey {
  DATA_SOURCES = 'data-sources',
  SEARCH = 'search',
  TIMELINE = 'timeline',
  SETTINGS = 'settings'
}


const App: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState(RouteKey.SEARCH);
  const searchScreen = useRef<SearchScreen>(null);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        className="app-sidebar"
        collapsed={true}
        style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0 }}
      >
        <div className="logo" />
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={[selectedItem]}
          onClick={(item) => setSelectedItem(item.key as RouteKey)}
        >
          <Menu.Item key={RouteKey.DATA_SOURCES}>
            <Icon type="database" />
            <span>Data Sources</span>
          </Menu.Item>
          <Menu.Item key={RouteKey.SEARCH}>
            <Icon type="search" />
            <span>Search</span>
          </Menu.Item>
          <Menu.Item key={RouteKey.TIMELINE}>
            <Icon type="line-chart" />
            <span>Timeline</span>
          </Menu.Item>
          <Menu.Item key={RouteKey.SETTINGS} style={{ position: 'absolute', bottom: 0 }}>
            <Icon type="setting" />
            <span>Settings</span>
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout style={{ marginLeft: 80 }}>
        <Content>
          <DataSourcesScreen
            visible={selectedItem === RouteKey.DATA_SOURCES}
            onDataSourceSearch={(ds) => {
              searchScreen.current && searchScreen.current.selectDataSourceInForm(ds);
              setSelectedItem(RouteKey.SEARCH);
            }}
          />
          <SearchScreen ref={searchScreen} visible={selectedItem === RouteKey.SEARCH} />
          <TimelineScreen visible={selectedItem === RouteKey.TIMELINE} />
        </Content>
      </Layout>
    </Layout>
  );
}


export default App;
