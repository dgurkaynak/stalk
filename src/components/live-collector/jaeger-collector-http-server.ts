import * as http from 'http';
import * as thrift from '../../vendor/thrift';
import * as JaegerTypes from '../../vendor/jaeger/gen-nodejs/jaeger_types';
import { convertFromJaegerBatchThrift } from '../../model/jaeger';
import { Span } from '../../model/interfaces';

const Transport: any = thrift.TFramedTransport;
const Protocol: any = thrift.TBinaryProtocol;

export enum JaegerCollectorHTTPServerState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running'
}

export class JaegerCollectorHTTPServer {
  private port: number = 14268;
  private state: JaegerCollectorHTTPServerState =
    JaegerCollectorHTTPServerState.STOPPED;
  private server: http.Server;
  onSpansRecieve: (spans: Span[]) => void = () => {};
  onStateChange: (state: JaegerCollectorHTTPServerState) => void = () => {};

  private binded = {
    onRequest: this.onRequest.bind(this),
    onClose: this.onClose.bind(this),
    onError: this.onError.bind(this)
  };

  getPort() {
    return this.port;
  }

  setPort(port: number) {
    if (this.state != JaegerCollectorHTTPServerState.STOPPED) {
      return false;
    }
    if (port < 1 || port > 65535) {
      return false;
    }
    this.port = port;
    return true;
  }

  async start() {
    if (this.state != JaegerCollectorHTTPServerState.STOPPED) {
      throw new Error(`Server is already running`);
    }

    this.state = JaegerCollectorHTTPServerState.STARTING;
    this.server = http.createServer();
    this.onStateChange(this.state);

    return new Promise((resolve, reject) => {
      const onListening = () => {
        this.server.removeListener('error', onError);

        this.bindEvents();
        this.state = JaegerCollectorHTTPServerState.RUNNING;
        this.onStateChange(this.state);

        resolve();
      };

      const onError = (err: Error) => {
        this.server.removeListener('listening', onListening);

        // No need to call `unbindEvents()`, we haven't binded at all
        this.server.close();
        this.server = null;
        this.state = JaegerCollectorHTTPServerState.STOPPED;
        this.onStateChange(this.state);

        reject(err);
      };

      this.server.once('listening', onListening);
      this.server.once('error', onError);

      this.server.listen(this.port);
    });
  }

  async stop() {
    if (this.state != JaegerCollectorHTTPServerState.RUNNING) {
      throw new Error(`Server is not running`);
    }

    this.onClose();
  }

  private bindEvents() {
    this.server.on('request', this.binded.onRequest);
    this.server.on('error', this.binded.onError);
    this.server.on('close', this.binded.onClose);
  }

  private unbindEvents() {
    this.server?.removeListener('request', this.binded.onRequest);
    this.server?.removeListener('error', this.binded.onError);
    this.server?.removeListener('close', this.binded.onClose);
  }

  private onRequest(
    request: http.IncomingMessage,
    response: http.ServerResponse
  ) {
    // Enable CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept'
    );

    if (request.method.toLowerCase() == 'options') {
      response.writeHead(200);
      response.end();
      return;
    }

    if (
      request.url.indexOf('/api/traces') == -1 ||
      request.method.toLowerCase() != 'post'
    ) {
      response.writeHead(501, 'Not Implemented');
      response.end();
      return;
    }

    const body: any[] = [];
    request
      .on('data', chunk => {
        body.push(chunk);
      })
      .on('end', () => {
        const buffer = Buffer.concat(body);

        // at this point, `body` has the entire request body stored in it as a string
        const bufTrans = new Transport(buffer);
        const myprot = new Protocol(bufTrans);
        const batch = new (JaegerTypes.Batch as any)();

        try {
          (batch as any).read(myprot);

          const spans = convertFromJaegerBatchThrift(batch);
          this.onSpansRecieve(spans);
        } catch (err) {
          console.error(`Could not parse jaeger batch binary thrift`, {
            err,
            batch
          });
        }

        response.statusCode = 202;
        response.end();
      });
  }

  private onError(err: Error) {
    console.error(
      `An unexpected error happend in Jaeger Agent UDP Server`,
      err
    );
  }

  private onClose() {
    this.unbindEvents();
    try {
      this.server?.close();
    } catch (err) {
      /* NOOP */
    }
    this.server = null;
    this.state = JaegerCollectorHTTPServerState.STOPPED;
    this.onStateChange(this.state);
  }
}
