import React, { ChangeEvent } from 'react';
import Icon from '@mdi/react';
import { Span } from '../../model/interfaces';
import { Stage } from '../../model/stage';
import Fuse from 'fuse.js';
import * as ErrorDetection from '../../model/error-detection';
import { serviceNameOf } from '../../model/span-grouping/service-name';
import { formatMicroseconds } from '../../utils/format-microseconds';

import './span-detail.css';
import {
  mdiMagnify,
  mdiCursorDefaultClickOutline,
  mdiEmoticonSadOutline,
  mdiAlert,
} from '@mdi/js';

const styles: { [key: string]: React.CSSProperties } = {
  header: {
    fontSize: 15,
    fontWeight: 500,
    borderBottom: '1px solid #eee',
    paddingBottom: 4,
    marginBottom: 4,
    marginTop: 12,
    userSelect: 'none',
    wordBreak: 'break-all',
  },
};

export interface SpanDetailState {
  span: Span;
  searchQuery: string;
}

export class SpanDetail extends React.Component<{}, SpanDetailState> {
  private stage = Stage.getSingleton();
  private binded = {
    onSearchInputChange: this.onSearchInputChange.bind(this),
  };

  constructor(props: {}) {
    super(props);
    this.state = {
      span: null,
      searchQuery: '',
    };
  }

  setSpan(span: Span) {
    this.setState({ span });
  }

  private onSearchInputChange(e: ChangeEvent) {
    const target = e.target as HTMLInputElement;
    this.setState({ searchQuery: target.value });
  }

  private renderSearchBar() {
    return (
      <div className="input-with-svg-icon-container" style={{ width: '100%' }}>
        <input
          type="search"
          className="small borderless"
          placeholder="Search..."
          style={{ width: '100%' }}
          onChange={this.binded.onSearchInputChange}
        />
        <Icon path={mdiMagnify} color="inherit" />
      </div>
    );
  }

  private renderFullscreenMessage(icon: string, message: string) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Icon path={icon} color="#ccc" style={{ width: 30, height: 30 }} />
        <span style={{ color: '#ccc', marginTop: 6, fontWeight: 600 }}>
          {message}
        </span>
      </div>
    );
  }

  private renderContent() {
    const { span } = this.state;

    if (!span) {
      return this.renderFullscreenMessage(
        mdiCursorDefaultClickOutline,
        'No Span Selected'
      );
    }

    return (
      <>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            borderBottom: '1px solid #eee',
            paddingBottom: 4,
            marginBottom: 4,
            userSelect: 'text',
            wordBreak: 'break-all',
          }}
        >
          {span.operationName}
        </div>
        <div className="key-value-row">
          <div>Service:</div>
          <div style={{ fontWeight: 600 }}>{serviceNameOf(span)}</div>
        </div>
        <div className="key-value-row">
          <div>Total Time:</div>
          <div style={{ fontWeight: 600 }}>
            {formatMicroseconds(span.finishTime - span.startTime)}
          </div>
        </div>
        <div className="key-value-row">
          <div>Self Time:</div>
          <div style={{ fontWeight: 600 }}>
            {formatMicroseconds(this.stage.getSpanSelfTime(span.id))}
          </div>
        </div>
        <div className="key-value-row" title="Relative to stage beginning">
          <div>Start Time:</div>
          <div style={{ fontWeight: 600 }}>
            {formatMicroseconds(span.startTime - this.stage.startTimestamp)}
          </div>
        </div>
        <div className="key-value-row">
          <div>Span ID:</div>
          <div>{span.id}</div>
        </div>
        <div className="key-value-row">
          <div>Trace ID:</div>
          <div>{span.traceId}</div>
        </div>

        <div style={styles.header}>Tags</div>
        {Object.keys(span.tags).length > 0 ? (
          Object.keys(span.tags)
            .sort()
            .map((tagKey) => {
              const tagValue = span.tags[tagKey];
              const rowStyle = ErrorDetection.checkTag(tagKey, tagValue)
                ? { color: 'rgba(255, 26, 26, 0.85)' }
                : {};
              return (
                <div className="key-value-row" key={tagKey} style={rowStyle}>
                  <div>{tagKey}:</div>
                  <div style={{ fontWeight: 600 }}>{tagValue.toString()}</div>
                </div>
              );
            })
        ) : (
          <span>No tags</span>
        )}

        <div style={styles.header}>Process Tags</div>
        {Object.keys(span.process?.tags || {}).length > 0 ? (
          Object.keys(span.process.tags)
            .sort()
            .map((tagKey) => {
              const tagValue = span.process.tags[tagKey];
              return (
                <div className="key-value-row" key={tagKey}>
                  <div>{tagKey}:</div>
                  <div style={{ fontWeight: 600 }}>{tagValue.toString()}</div>
                </div>
              );
            })
        ) : (
          <span>No tags</span>
        )}
      </>
    );
  }

  render() {
    return (
      <div
        className="span-detail"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ borderBottom: '1px solid #ccc', padding: 4 }}>
          {this.renderSearchBar()}
        </div>
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: 12 }}>
          {this.renderContent()}
        </div>
      </div>
    );
  }
}
