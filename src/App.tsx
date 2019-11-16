import React, { useState, useRef } from 'react';
import { Layout, Drawer } from 'antd';
import DataSourcesScreen from './components/datasource/screen';
import SearchScreen from './components/search/screen';
import TimelineScreen from './components/timeline/screen';
import './App.css';

const { Content } = Layout;


const App: React.FC = () => {
  const [shouldShowDataSourceDrawer, setShouldShowDataSourceDrawer] = useState(false);
  const [shouldShowSearchDrawer, setShouldShowSearchDrawer] = useState(false);
  const searchScreen = useRef<SearchScreen>(null);

  return (
    <Layout>
      <Content>
        <TimelineScreen
          visible={true}
          onDataSourceClick={() => setShouldShowDataSourceDrawer(true)}
          onSearchTraceClick={() => setShouldShowSearchDrawer(true)}
        />

        <Drawer
          width={500}
          placement="left"
          closable={false}
          onClose={() => setShouldShowDataSourceDrawer(false)}
          visible={shouldShowDataSourceDrawer}
          bodyStyle={{ padding: 0 }}
        >
          <DataSourcesScreen
            visible={true}
            onDataSourceSearch={(ds) => {
              searchScreen.current && searchScreen.current.selectDataSourceInForm(ds);
              setShouldShowDataSourceDrawer(false);
              setShouldShowSearchDrawer(true);
            }}
          />
        </Drawer>

        <Drawer
          width={700}
          placement="left"
          closable={false}
          onClose={() => setShouldShowSearchDrawer(false)}
          visible={shouldShowSearchDrawer}
          bodyStyle={{ padding: 0 }}
        >
          <SearchScreen ref={searchScreen} visible={true} />
        </Drawer>
      </Content>
    </Layout>
  );
}


export default App;
