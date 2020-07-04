import * as http from 'http';
import { convertFromZipkinTrace } from '../../model/zipkin';
import { Span } from '../../model/interfaces';

export enum ZipkinCollectorHTTPServerState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
}

export class ZipkinCollectorHTTPServer {
  private port: number = 9411;
  private state: ZipkinCollectorHTTPServerState =
    ZipkinCollectorHTTPServerState.STOPPED;
  private server: http.Server;
  onSpansRecieve: (spans: Span[]) => void = () => {};
  onStateChange: (state: ZipkinCollectorHTTPServerState) => void = () => {};

  private binded = {
    onRequest: this.onRequest.bind(this),
    onClose: this.onClose.bind(this),
    onError: this.onError.bind(this),
  };

  getPort() {
    return this.port;
  }

  setPort(port: number) {
    if (this.state != ZipkinCollectorHTTPServerState.STOPPED) {
      return false;
    }
    if (port < 1 || port > 65535) {
      return false;
    }
    this.port = port;
    return true;
  }

  async start() {
    if (this.state != ZipkinCollectorHTTPServerState.STOPPED) {
      throw new Error(`Server is already running`);
    }

    this.state = ZipkinCollectorHTTPServerState.STARTING;
    this.server = http.createServer();
    this.onStateChange(this.state);

    return new Promise((resolve, reject) => {
      const onListening = () => {
        this.server.removeListener('error', onError);

        this.bindEvents();
        this.state = ZipkinCollectorHTTPServerState.RUNNING;
        this.onStateChange(this.state);

        resolve();
      };

      const onError = (err: Error) => {
        this.server.removeListener('listening', onListening);

        // No need to call `unbindEvents()`, we haven't binded at all
        this.server.close();
        this.server = null;
        this.state = ZipkinCollectorHTTPServerState.STOPPED;
        this.onStateChange(this.state);

        reject(err);
      };

      this.server.once('listening', onListening);
      this.server.once('error', onError);

      this.server.listen(this.port);
    });
  }

  async stop() {
    if (this.state != ZipkinCollectorHTTPServerState.RUNNING) {
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
      request.url.indexOf('/api/v2/spans') == -1 ||
      request.method.toLowerCase() != 'post'
    ) {
      response.writeHead(501, 'Not Implemented');
      response.end();
      return;
    }

    const body: any[] = [];
    request
      .on('data', (chunk) => {
        body.push(chunk);
      })
      .on('end', () => {
        const buffer = Buffer.concat(body);
        const bodyStr = buffer.toString();

        try {
          const spans = convertFromZipkinTrace(JSON.parse(bodyStr));
          this.onSpansRecieve(spans);
        } catch (err) {
          console.error(`Could not parse jaeger batch binary thrift`, {
            err,
            body: bodyStr,
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
    this.state = ZipkinCollectorHTTPServerState.STOPPED;
    this.onStateChange(this.state);
  }
}
