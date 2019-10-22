import * as _ from 'lodash';
import { Span } from '../span';
import { Trace } from '../trace';
import { SpanGroup } from '../span-group/span-group';


export interface SpanGroupingOptions {
  key: string; // grouping unique key, like `trace`
  name: string; // human readable name, `Trace`
  groupBy: (span: Span, trace: Trace) => [ string, string ]; // [ group id, human readable group name ]
}

export class SpanGrouping {
  private groups: { [key: string]: SpanGroup } = {};
  private spanIdToGroupId: { [key: string]: string } = {};

  constructor(private options: SpanGroupingOptions) {
    // Noop
  }

  addSpan(span: Span, trace: Trace) {
    if (this.spanIdToGroupId[span.id]) return;

    const result = this.options.groupBy(span, trace);
    if (!_.isArray(result) || result.length !== 2) {
      throw new Error('Group function must return array with 2 strings: [ groupId, groupName ]');
    }

    const [ groupId, groupName ] = result;
    if (!this.groups[groupId]) this.groups[groupId] = new SpanGroup(groupId, groupName);
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

  getGroupById(id: string) {
    return this.groups[id];
  }

  groupOf(spanOrId: Span | string) {
    const id = typeof spanOrId === 'object' ? spanOrId.id : spanOrId;
    const groupId = this.spanIdToGroupId[id];
    if (!groupId) return;
    return this.groups[groupId];
  }
}
