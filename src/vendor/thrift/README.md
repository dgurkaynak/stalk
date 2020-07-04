## Thrift node.js library

This folder is directly local copy of:
https://github.com/apache/thrift/tree/master/lib/nodejs/lib/thrift

Because offical `thrift` package on npm (https://www.npmjs.com/package/thrift)
does not export anything?!? Also it ships with just core thrift class, we need
some transports & protocols.

- Commit date: 7 Jan 2020
- Commit version: 30ac2598e84928d9af7066b5d3248b7aea4376b2
- Commit title: THRIFT-5003: Websocket Connection in Browsers with nodejs code

### Packages required to be installed

- `node-int64`

### Modifications taken:

- `ws_connection.js` file is truncated, because it requires additional package `isomorphic-ws`.
