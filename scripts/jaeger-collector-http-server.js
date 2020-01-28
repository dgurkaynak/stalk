const http = require('http');
const port = 14268;
const thrift = require('../src/vendor/thrift');
const JaegerTypes = require('../src/vendor/jaeger/gen-nodejs/jaeger_types');

const Transport = thrift.TFramedTransport;
const Protocol = thrift.TBinaryProtocol;

const server = http.createServer((request, response) => {

  // TODO: Check if coming to `/api/traces` with a POST request

  let body = [];
  request.on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    const buffer = Buffer.concat(body);

    // at this point, `body` has the entire request body stored in it as a string
    const bufTrans = new Transport(buffer);
    const myprot = new Protocol(bufTrans);
    const batch = new JaegerTypes.Batch();
    batch.read(myprot);
    console.log(batch);
  });
})

server.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err)
  }

  console.log(`server is listening on ${port}`)
});
