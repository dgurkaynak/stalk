// Graph-like data structure for fast traversal
export class SpanGroupNode {
  spanId: string;
  parent?: SpanGroupNode;
  follows?: SpanGroupNode;
  children: SpanGroupNode[] = [];

  constructor(spanId: string) {
    this.spanId = spanId;
  }

  get parentOrFollows() {
    return this.parent || this.follows;
  }
}

export default SpanGroupNode;
