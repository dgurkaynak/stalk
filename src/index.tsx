import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import DatasourceManager from './model/datasource/manager';
import SpanGroupingManager from './model/span-grouping/manager';
import SpanColoringManager from './model/span-coloring-manager';
import SpanLabellingManager from './model/span-labelling-manager';


async function main() {
    await Promise.all([
        DatasourceManager.getSingleton().init(),
        SpanGroupingManager.getSingleton().init(),
        SpanColoringManager.getSingleton().init(),
        SpanLabellingManager.getSingleton().init(),
    ]);

    ReactDOM.render(<App />, document.getElementById('root'));
}

main().catch(err => console.error(err));
