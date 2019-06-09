import * as _ from 'lodash';
import { Span } from '../span';
import { GroupSpanNode } from './group-span-node';



export class Group {
    readonly id: string;
    readonly name: string;
    private spans: Span[] = [];
    private spansById: { [key: string]: Span } = {};
    private _startTimestamp = Infinity;
    private _finishTimestamp = -Infinity;

    private missingNodeDependents: { [key: string]: Set<string> } = {};
    private nodes: { [key: string]: GroupSpanNode } = {};
    rootNodes: GroupSpanNode[] = [];
    get orphanNodes() {
        const sets = _.values(this.missingNodeDependents);
        return _.flatten(sets.map(set => Array.from(set))).map(spanId => this.nodes[spanId]);
    }


    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }


    add(span: Span) {
        if (this.spansById[span.id]) return;

        this.spans.push(span);
        this.spansById[span.id] = span;
        this._startTimestamp = Math.min(this._startTimestamp, span.startTime);
        this._finishTimestamp = Math.max(this._finishTimestamp, span.finishTime);

        this.setupNode(span);

        // TODO: Sorting on each added span can be costly
        // Refer: `sortPriority` => ` active` | `passing` on
        // https://github.com/techfort/LokiJS/wiki/Indexing-and-Query-Performance#dynamic-view-pipelines
        // this.spans = this.sortSpans();
    }


    remove(spanOrId: Span | string) {
        const index = this.indexOf(spanOrId);
        if (index === -1) return;
        const span = this.spans[index];
        this.spans.splice(index, 1);
        delete this.spansById[span.id];

        /**
         * Start of finish time may be changed
         */
        let isStartTimeInvalid = this._startTimestamp === span.startTime;
        let isFinishTimeInvalid = this._finishTimestamp === span.finishTime;
        if (isStartTimeInvalid || isFinishTimeInvalid) {
            if (isStartTimeInvalid) this._startTimestamp = Infinity;
            if (isFinishTimeInvalid) this._finishTimestamp = -Infinity;

            // TODO: If spans are ordered, do this better
            this.spans.forEach(({ startTime, finishTime }) => {
                if (isStartTimeInvalid) this._startTimestamp = Math.min(this._startTimestamp, startTime);
                if (isFinishTimeInvalid) this._finishTimestamp = Math.max(this._finishTimestamp, finishTime);
            });
        }

        /**
         * Adjust node stuff
         */
        const node = this.nodeOf(span.id)!;
        delete this.nodes[span.id];

        // Remove from parent/follows node
        const parentNode = node.parent || node.follows;
        if (parentNode) {
            const nodeIndex = parentNode.children.indexOf(node);
            if (nodeIndex > -1) parentNode.children.splice(nodeIndex, 1);
        }

        // Remove from rootNodes
        const rootNodeIndex = this.rootNodes.indexOf(node);
        if (rootNodeIndex > -1) {
            this.rootNodes.splice(rootNodeIndex, 1);
        }

        // Remove from children node
        node.children.forEach((childNode) => {
            childNode.parent = undefined;
            childNode.follows = undefined;
        });
        // If children exist, they're orphan now
        if (node.children.length > 0) {
            this.missingNodeDependents[span.id] = new Set(node.children.map(child => child.spanId));
        }

        // Remove from dependency map
        // If parentNode exists, it means that span has no missing dependency
        if (!parentNode) {
            _.forEach(this.missingNodeDependents, (dependencies, parentId) => {
                if (!dependencies.has(span.id)) return;
                dependencies.delete(span.id);
                if (dependencies.size === 0) delete this.missingNodeDependents[parentId];
            });
        }

        return span;
    }


    private setupNode(spanOrId: Span | string) {
        const span = this.get(spanOrId);
        const node = this.nodeOf(span.id, true)!;

        if (span.references.length === 0) {
            this.rootNodes.push(node);
        } else {
            // ASSUMING IT HAS JUST ONE REFERENCE
            const refType = span.references[0].type;
            const refSpanId = span.references[0].spanId;
            const refNode = this.nodeOf(refSpanId);

            if (refNode) {
                // Referenced node exists, bind it
                refNode.children.push(node);
                if (refType === 'childOf') node.parent = refNode;
                else if (refType === 'followsFrom') node.follows = refNode;
            } else {
                // Referenced node does not exists, add dependency
                if (!this.missingNodeDependents[refSpanId]) {
                    this.missingNodeDependents[refSpanId] = new Set<string>();
                }
                this.missingNodeDependents[refSpanId].add(span.id);
            }
        }

        // Consume dependencies if exist
        const dependencies = this.missingNodeDependents[span.id];
        delete this.missingNodeDependents[span.id];
        if (dependencies) dependencies.forEach(spanId => this.setupNode(spanId));
    }


    nodeOf(spanOrId: Span | string, createNew = false) {
        const id = typeof spanOrId === 'object' ? spanOrId.id : spanOrId;
        const node = this.nodes[id];
        if (node) return node;
        if (!createNew) return;
        this.nodes[id] = new GroupSpanNode(id);
        return this.nodes[id];
    }


    [Symbol.iterator]() {
        const sortedSpans = this.sortSpans();
        let i = 0;

        return {
            next() {
                let value: Span | undefined;
                let done = true;

                if (sortedSpans[i] !== undefined) {
                    value = sortedSpans[i];
                    done = false;
                    i += 1;
                }

                return {
                    value: value,
                    done: done
                }
            }
        };
    }


    sortSpans() {
        const spans: Span[] = [];
        const rootNodesSorted = this.sortNodes(this.rootNodes);

        rootNodesSorted.forEach((rootNode) => {
            const rootSpan = this.get(rootNode.spanId);
            spans.push(rootSpan);

            // Perform a breadth-first style traversal
            const queue: GroupSpanNode[] = [ ...this.sortNodes(rootNode.children) ];
            while (queue.length > 0) {
                const node = queue.shift()!;
                const span = this.get(node.spanId);
                spans.push(span);
                queue.push(...this.sortNodes(node.children));
            }
        });

        // Orphan nodes... Aaaand god save the duplication
        const orphanNodesSorted = this.sortNodes(this.orphanNodes);
        orphanNodesSorted.forEach((orphanNode) => {
            const rootSpan = this.get(orphanNode.spanId);
            spans.push(rootSpan);

            // Perform a breadth-first style traversal
            const queue: GroupSpanNode[] = [ ...this.sortNodes(orphanNode.children) ];
            while (queue.length > 0) {
                const node = queue.shift()!;
                const span = this.get(node.spanId);
                spans.push(span);
                queue.push(...this.sortNodes(node.children));
            }
        });

        return spans;
    }


    private sortNodes(nodes: GroupSpanNode[]) {
        return nodes.slice().sort((a, b) => {
            const aSpan = this.get(a.spanId);
            const bSpan = this.get(b.spanId);
            return aSpan.startTime - bSpan.startTime;
        });
    }


    get(spanOrId: Span | string) {
        const id = typeof spanOrId === 'object' ? spanOrId.id : spanOrId;
        return this.spansById[id];
    }


    indexOf(spanOrId: Span | string) {
        const id = typeof spanOrId === 'object' ? spanOrId.id : spanOrId;
        return _.findIndex(this.spans, span => span.id === id);
    }


    find(predicate: (span: Span) => boolean) {
        return _.find(this.spans, predicate);
    }


    get length() { return this.spans.length; }
}
