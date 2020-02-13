import * as opentracing from 'opentracing';
import { getOperationNamePrefix } from './opname-prefix-decorator';
import getGlobal from '../get-global';

const NoopTracer = new opentracing.Tracer();

/**
 * Some types
 */
type ArgumentTypes<T> = T extends (...args: infer U) => infer R ? U : never;
type ReplaceReturnType<T, TNewReturn> = (...a: ArgumentTypes<T>) => TNewReturn;
type Handler = (span: opentracing.Span, ...args: any[]) => opentracing.Span;
interface TraceOptions<T> {
  operationName: string;
  handler: T;
  autoFinish: boolean;
}

// Core of the decorator, that can be used in plain function form
// like: `trace(traceOptions, someFunction)`
export function trace<T extends Handler>(
  options: TraceOptions<T>,
  originalFn: ReplaceReturnType<T, any>
): ReplaceReturnType<T, any> {
  return function(...args: any[]) {
    let newSpan: opentracing.Span;

    // Prefix op name
    options.operationName = `${getOperationNamePrefix(this) || ''}${options.operationName}`;

    try {
      newSpan = options.handler.apply(this, args);
    } catch (err) {
      console.error(
        `Unexpected error in traced method "${options.operationName}"s handler`
      );
      throw err;
    }

    // Overwrite operation name
    // TODO: Find a way to do this if only operation name is empty?
    newSpan.setOperationName(options.operationName);

    // Replace the first argument with new context
    args.splice(0, 1, newSpan);

    // Execute original method
    try {
      const rv = originalFn.apply(this, args);

      // If auto finish is false, return rv immediately
      if (!options.autoFinish) {
        return rv;
      }

      // Auto finish is on, check return value is promise
      // Instead of `instanceof` check, prefer checking `.then()` method exists on object.
      // User may be using custom promise polyfill (https://stackoverflow.com/a/27746324)
      if (typeof rv == 'object' && rv.then && rv.catch) {
        return rv
          .then((val: any) => {
            // Promise resolved
            newSpan.finish();
            return val;
          })
          .catch((err: any) => {
            // Promise is rejected
            // https://github.com/opentracing/specification/blob/master/semantic_conventions.md
            newSpan.log({
              event: 'error',
              error: err.message,
              message: err.message,
              stack: err.stack,
              'error.kind': err.name
            });
            newSpan.setTag(opentracing.Tags.ERROR, true);
            newSpan.finish();
            throw err;
          });
      }

      // If return value is not promise, finish and return
      newSpan.finish();
      return rv;
    } catch (err) {
      // Method throwed an error
      // https://github.com/opentracing/specification/blob/master/semantic_conventions.md
      newSpan.log({
        event: 'error',
        error: err.message || err.name,
        message: err.message,
        stack: err.stack,
        'error.kind': err.name
      });
      newSpan.setTag(opentracing.Tags.ERROR, true);
      newSpan.finish();
      throw err;
    }
  };
}

// Decorator version
// Intentionally not using name "trace", because there lots of things with that name
export function Stalk<T extends Handler>(
  options: Partial<TraceOptions<T>> & { handler: T } // force `handler`
) {
  // Handler method should be same signature with original traced method,
  // but it should return a opentracing.Span.
  // As far as I've tried, we can not force handler's signature according to
  // original method. So, we're going from the other way.
  type TracedMethod = ReplaceReturnType<T, any>;

  return (
    target: any,
    propertyName: string,
    propertyDesciptor: TypedPropertyDescriptor<TracedMethod>
  ) => {
    const originalMethod = propertyDesciptor.value;

    if (typeof options.autoFinish !== 'boolean') {
      options.autoFinish = true;
    }

    if (typeof options.operationName !== 'string') {
      options.operationName = propertyName;
    }

    if (typeof options.handler != 'function') {
      throw new Error(`Expected handler type "${typeof options.handler}"`);
    }

    // Replace the method
    propertyDesciptor.value = trace(options as TraceOptions<T>, originalMethod);

    return propertyDesciptor;
  };
}

// Gathering tracer to be used, will be called with same arguments as decorated method
function getTracer(span: any): opentracing.Tracer {
  // Check first whether passed span has a `tracer()` method (span-like check)
  if (hasTracerMethod(span)) {
    return span.tracer();
  }

  // Get global.opentracing.globalTracer() if exists
  const globalOpentracingRef = getGlobal().opentracing;
  if (
    globalOpentracingRef &&
    typeof globalOpentracingRef.globalTracer == 'function'
  ) {
    return globalOpentracingRef.globalTracer();
  }

  // Last resort, use embeded-opentracing
  return opentracing.globalTracer();
}

// Checks the `thing` has `.tracer()` method
function hasTracerMethod(span: any) {
  return span && span.tracer && typeof span.tracer == 'function';
}

// Checks the `thing` has `.context()` method
function hasContextMethod(span: any) {
  return span && span.context && typeof span.context == 'function';
}

export function ChildOf(
  parentSpan: opentracing.Span,
  ...args: any[]
): opentracing.Span {
  if (parentSpan === undefined) {
    return NoopTracer.startSpan('', {});
  }
  if (!parentSpan) {
    throw new Error(`Traced method's first argument must be a span`);
  }
  if (!hasContextMethod(parentSpan)) {
    throw new Error(
      `Passed span is not OpenTracing-compatible, it does not context() method`
    );
  }

  const tracer = getTracer(parentSpan);
  return tracer.startSpan('', { childOf: parentSpan.context() });
}

export function FollowsFrom(
  parentSpan: opentracing.Span,
  ...args: any[]
): opentracing.Span {
  if (parentSpan === undefined) {
    return NoopTracer.startSpan('', {});
  }
  if (!parentSpan) {
    throw new Error(`Traced method's first argument must be a span`);
  }
  if (!hasContextMethod(parentSpan)) {
    throw new Error(
      `Passed span is not OpenTracing-compatible, it does not context() method`
    );
  }

  const tracer = getTracer(parentSpan);
  return tracer.startSpan('', {
    references: [opentracing.followsFrom(parentSpan.context())]
  });
}

export function NewTrace(
  parentSpan: opentracing.Span,
  ...args: any[]
): opentracing.Span {
  if (parentSpan === undefined) {
    return NoopTracer.startSpan('', {});
  }

  // Parent span is ignored
  const tracer = getTracer(null);
  return tracer.startSpan('', {});
}
