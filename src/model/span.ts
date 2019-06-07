export interface Span {
  id: string,
  traceId: string,
  operationName: string,
  startTime: number, // us
  finishTime: number, // us
  references: {
    type: 'childOf' | 'followsFrom',
    spanId: string,
    traceId: string
  }[],
  tags: { [key: string]: string },
  logs: {
    timestamp: number,
    fields: { [key: string]: string }
  }[],
  // Jaeger-specific `process`
  process?: {
    serviceName: string,
    id: string, // `p1`, `p2` like
    tags: { [key: string]: string }
  },
  // Zipkin-specific `localEndpoint`
  localEndpoint?: {
    serviceName: string,
    ipv4?: string,
    port?: number
  }
}
