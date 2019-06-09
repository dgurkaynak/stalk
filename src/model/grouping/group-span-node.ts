

// Graph-like data structure for fast traversal
export class GroupSpanNode {
    spanId: string;
    parent?: GroupSpanNode;
    follows?: GroupSpanNode;
    children: GroupSpanNode[] = [];


    constructor(spanId: string) {
        this.spanId = spanId;
    }


    get parentOrFollows() {
        return this.parent || this.follows;
    }
}



export default GroupSpanNode;
