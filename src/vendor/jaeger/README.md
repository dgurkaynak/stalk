## `jaeger.thrift` file

This file is a concataned version of following files:
- [jaeger.thrift](https://github.com/jaegertracing/jaeger-idl/blob/master/thrift/jaeger.thrift) - *cfd3d58c9ac66bb410ff378de1d77ad378142c15 (Jan 14, 2020)*
- [agent.thrift](https://github.com/jaegertracing/jaeger-idl/blob/master/thrift/agent.thrift) - *d4063e359bc52eca57cdbeb92a179fd3aa0250d6 (Apr 23, 2019)*

#### Modifications taken:
- Remove `include` and `namespace`s
- Remove `emitZipkinBatch` line in `agent.thrift`, we don't need it
- Merge two files into `jaeger.thrift`

## Generating js files from thrift

- Make sure you've installed thrift:
```
brew update
brew install thrift
```

- Generate js files
```
cd src/vendor/jaeger
thrift --gen js:node jaeger.thrift
```

#### Modifications taken:

Fix `thrift` library reference in generated js files. It must point into our local copy of thrift lib. Replace `require('thrift')` with `require('../../thrift')`.
