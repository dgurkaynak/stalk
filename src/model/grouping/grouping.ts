import * as _ from 'lodash';
import { Span } from '../span';
import { Group } from './group';


export class Grouping {
    readonly key: string; // group key, like `trace`
    readonly name: string; // human readable name, `Trace`
    protected groupBy: (span: Span) => [ string, string ]; // [ group id, human readable group name ]
    protected groups: { [key: string]: Group } = {};
    protected spanIdToGroupId: { [key: string]: string } = {};


    constructor(options: {
        key: string,
        name: string,
        groupBy: (span: Span) => [ string, string ]
    }) {
        this.key = options.key;
        this.name = options.name;
        this.groupBy = options.groupBy;
    }


    addSpan(span: Span) {
        if (this.spanIdToGroupId[span.id]) return;

        const result = this.groupBy(span);
        if (!_.isArray(result) || result.length !== 2) {
            throw new Error('Group function must return array with 2 strings: [ groupId, groupName ]');
        }

        const [ groupId, groupName ] = result;
        if (!this.groups[groupId]) this.groups[groupId] = new Group(groupId, groupName);
        const group = this.groups[groupId];
        group.add(span);
        this.spanIdToGroupId[span.id] = groupId;
    }


    removeSpan(spanOrId: Span | string) {
        const id = typeof spanOrId == 'object' ? spanOrId.id : spanOrId;
        const groupId = this.spanIdToGroupId[id];
        if (!groupId) return;
        delete this.spanIdToGroupId[id];
        const group = this.groups[groupId];
        group.remove(id);
        if (group.length === 0) delete this.groups[groupId];
    }


    getAllGroups() {
        return _.values(this.groups);
    }


    groupOf(spanOrId: Span | string) {
        const id = typeof spanOrId === 'object' ? spanOrId.id : spanOrId;
        const groupId = this.spanIdToGroupId[id];
        if (!groupId) return;
        return this.groups[groupId];
    }
}
