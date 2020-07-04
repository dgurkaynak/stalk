import { BaseReporter } from './base-reporter';
import { Span as StalkSpan } from './span';
import { Stage } from '../../model/stage';
import { Trace } from '../../model/trace';
import { Span as ISpan } from '../../model/interfaces';
import groupBy from 'lodash/groupBy';
import * as shortid from 'shortid';
import * as os from 'os';

export class StalkStudioReporter extends BaseReporter {
  static PROCESS_ID = shortid.generate();

  private stage = Stage.getSingleton();
  private process = {
    id: 'self',
    serviceName: 'stalk-studio-renderer',
    tags: {
      hostname: os.hostname(),
      processId: StalkStudioReporter.PROCESS_ID,
    },
  };

  readonly accepts = {
    spanCreate: false,
    spanLog: false,
    spanFinish: true,
  };

  spans: ISpan[] = [];

  recieveSpanFinish(rawSpan: StalkSpan) {
    const data = rawSpan.toJSON();
    const span = {
      id: data.context.toSpanId(),
      traceId: data.context.toTraceId(),
      operationName: data.operationName,
      startTime: data.startTime * 1000,
      finishTime: data.finishTime * 1000,
      references: data.references.map((ref) => {
        const type =
          ref.type == 'child_of'
            ? 'childOf'
            : ref.type == 'follows_from'
            ? 'followsFrom'
            : undefined;
        if (!type) throw new Error(`Unknown reference type: "${type}"`);
        return {
          type,
          spanId: ref.referencedContext.toSpanId(),
          traceId: ref.referencedContext.toTraceId(),
        };
      }),
      tags: data.tags,
      logs: data.logs.map((log) => ({
        ...log,
        timestamp: log.timestamp * 1000,
      })),
      process: this.process,
    };
    this.spans.push(span as any);
  }

  close() {
    this.clear();
  }

  clear() {
    this.spans = [];
  }

  getTraces() {
    const spansByTraceId = groupBy(this.spans, (s) => s.traceId);
    return Object.keys(spansByTraceId).map((traceId) => {
      const traceSpans = spansByTraceId[traceId];
      return new Trace(traceSpans);
    });
  }

  importTraces() {
    const traces = this.getTraces();
    this.clear();
    traces.forEach((t) => this.stage.addTrace(t));
  }
}

export default StalkStudioReporter;
