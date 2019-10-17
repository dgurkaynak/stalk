import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';
import DatasourceManager from './model/datasource/manager';
import GroupingManager from './model/grouping/manager';


async function main() {
    await Promise.all([
        DatasourceManager.getSingleton().init(),
        GroupingManager.getSingleton().init(),
    ]);

    ReactDOM.render(<App />, document.getElementById('root'));
}
main().catch(err => console.error(err))



// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
