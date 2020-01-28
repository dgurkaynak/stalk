
const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const UdpPort = 6831;
const thrift = require('../src/vendor/thrift');
const AgentGen = require('../src/vendor/jaeger/gen-nodejs/Agent');

const Transport = thrift.TFramedTransport;
const Protocol = thrift.TCompactProtocol;


server.on('listening', function () {
  const address = server.address();
  console.log('UDP Server listening on ' + address.address + ':' + address.port);
});

server.on('message', function (message, remote) {
  const bufTrans = new Transport(message);
  const myprot = new Protocol(bufTrans);
  const asd = new AgentGen.Processor({
    emitBatch: (batch) => {
      console.log(JSON.stringify(batch, null, 4));
    }
  });
  asd.process(myprot);
});

server.bind(UdpPort);
