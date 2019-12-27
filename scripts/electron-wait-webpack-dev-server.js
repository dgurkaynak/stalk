// https://github.com/nayunhwan/Electron-CRA-TypeScript

const net = require('net');
const port = 9000;

process.env.ELECTRON_START_URL = `http://localhost:${port}`;

const client = new net.Socket();

let startedElectron = false;
const tryConnection = () =>
  client.connect(
    { port: port },
    () => {
      client.end();
      if (!startedElectron) {
        console.log('starting electron');
        startedElectron = true;
        const exec = require('child_process').exec;
        exec('./node_modules/.bin/electron .');
      }
    }
  );

tryConnection();

client.on('error', (error) => {
  setTimeout(tryConnection, 1000);
});
