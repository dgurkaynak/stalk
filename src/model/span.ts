/**
 * This file is going to be used by customization components
 * for monaca editor.
 */


export interface SpanLog {
  /**
   * Log timestamp, in us
   */
  timestamp: number,
  /**
   * Log `fields` object
   */
  fields: { [key: string]: string }
}

export interface Span {
  /**
   * Span ID
   */
  id: string,
  /**
   * Span's Trace ID
   */
  traceId: string,
  /**
   * Operation name
   */
  operationName: string,
  /**
   * Span start timestamp, in us
   */
  startTime: number,
  /**
   * Span finish timestamp, in us
   */
  finishTime: number, // us
  /**
   * Span reference objects
   */
  references: {
    type: 'childOf' | 'followsFrom',
    spanId: string,
    traceId: string
  }[],
  /**
   * Span tags object
   */
  tags: { [key: string]: string },
  /**
   * Span logs array
   */
  logs: SpanLog[],
  /**
   * Jaeger-specific `process` object
   */
  process?: {
    /**
     * Service name
     */
    serviceName: string,
    /**
     * Jaeger gives id like: `p1`, `p2`...
     */
    id: string, // `p1`, `p2` like
    /**
     * Process tags object
     */
    tags: { [key: string]: string }
  },
  /**
   * Zipkin-specific `localEndpoint` object
   */
  localEndpoint?: {
    /**
     * Service name
     */
    serviceName: string,
    ipv4?: string,
    port?: number
  }
}
