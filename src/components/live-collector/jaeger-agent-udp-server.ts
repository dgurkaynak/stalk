import * as dgram from 'dgram';
import * as thrift from '../../vendor/thrift';
import * as AgentGen from '../../vendor/jaeger/gen-nodejs/Agent';
import { convertFromJaegerBatchThrift } from '../../model/jaeger';
import { Span } from '../../model/interfaces';

const Transport: any = thrift.TFramedTransport;
const Protocol: any = thrift.TCompactProtocol;

export enum JaegerAgentUDPServerState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running'
}

export class JaegerAgentUDPServer {
  private port: number = 6831;
  private state: JaegerAgentUDPServerState = JaegerAgentUDPServerState.STOPPED;
  private server: dgram.Socket;
  onSpansRecieve: (spans: Span[]) => void = () => {};
  onStateChange: (state: JaegerAgentUDPServerState) => void = () => {};

  private binded = {
    onMessage: this.onMessage.bind(this),
    onError: this.onError.bind(this),
    onClose: this.onClose.bind(this)
  };

  getPort() {
    return this.port;
  }

  setPort(port: number) {
    if (this.state != JaegerAgentUDPServerState.STOPPED) {
      return false;
    }
    if (port < 1 || port > 65535) {
      return false;
    }
    this.port = port;
    return true;
  }

  async start() {
    if (this.state != JaegerAgentUDPServerState.STOPPED) {
      throw new Error(`Server is already running`);
    }

    this.state = JaegerAgentUDPServerState.STARTING;
    this.server = dgram.createSocket('udp4');
    this.onStateChange(this.state);

    return new Promise((resolve, reject) => {
      const onListening = () => {
        this.server.removeListener('error', onError);

        this.bindEvents();
        this.state = JaegerAgentUDPServerState.RUNNING;
        this.onStateChange(this.state);

        resolve();
      };

      const onError = (err: Error) => {
        this.server.removeListener('listening', onListening);

        // No need to call `unbindEvents()`, we haven't binded at all
        this.server.close();
        this.server = null;
        this.state = JaegerAgentUDPServerState.STOPPED;
        this.onStateChange(this.state);

        reject(err);
      };

      this.server.once('listening', onListening);
      this.server.once('error', onError);

      this.server.bind(this.port);
    });
  }

  async stop() {
    if (this.state != JaegerAgentUDPServerState.RUNNING) {
      throw new Error(`Server is not running`);
    }

    this.onClose();
  }

  private bindEvents() {
    this.server.on('message', this.binded.onMessage);
    this.server.on('error', this.binded.onError);
    this.server.on('close', this.binded.onClose);
  }

  private unbindEvents() {
    this.server?.removeListener('message', this.binded.onMessage);
    this.server?.removeListener('error', this.binded.onError);
    this.server?.removeListener('close', this.binded.onClose);
  }

  private onMessage(message: Buffer) {
    const bufTrans = new Transport(message);
    const prot = new Protocol(bufTrans);
    const processor = new AgentGen.Processor({
      emitBatch: (batch: any) => {
        try {
          const spans = convertFromJaegerBatchThrift(batch);
          this.onSpansRecieve(spans);
        } catch (err) {
          console.error(`Could not parse jaeger batch compact thrift`, {
            err,
            batch
          });
        }
      }
    });
    (processor as any).process(prot);
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
    this.state = JaegerAgentUDPServerState.STOPPED;
    this.onStateChange(this.state);
  }
}
