import tippy, { Instance as TippyInstance } from 'tippy.js';
import { ToolbarMenuList, ToolbarMenuListOptions } from './menu-list';
import {
  DataSourceManager,
  DataSourceManagerEvent
} from '../../model/datasource/manager';
import { DataSourceType, DataSource } from '../../model/datasource/interfaces';
import { Stage, StageEvent } from '../../model/stage';
import { Trace } from '../../model/trace';
import { TooltipManager } from '../ui/tooltip/tooltip-manager';
import * as opentracing from 'opentracing';
import { OperationNamePrefix } from '../../utils/self-tracing/opname-prefix-decorator';
import {
  Stalk,
  NewTrace,
  ChildOf,
  FollowsFrom
} from '../../utils/self-tracing/trace-decorator';
import { Modal, ModalCloseTriggerType } from '../ui/modal/modal';
import { ModalManager } from '../ui/modal/modal-manager';
import { DataSourceFormModalContent } from '../datasource/datasource-form-modal-content';
import shortid from 'shortid';

import SvgPlus from '!!raw-loader!@mdi/svg/svg/plus.svg';
import SvgDatabase from '!!raw-loader!@mdi/svg/svg/database.svg';
import SvgMagnify from '!!raw-loader!@mdi/svg/svg/magnify.svg';
import SvgSourceBranch from '!!raw-loader!@mdi/svg/svg/source-branch.svg';
import SvgSettings from '!!raw-loader!@mdi/svg/svg/settings.svg';
import './app-toolbar.css';

export interface AppToolbarOptions {}

export type AppToolbarButtonType =
  | 'dataSources'
  | 'search'
  | 'traces'
  | 'widgets'
  | 'settings';

export type AppToolbarButtonState = 'selected' | 'disabled';

@OperationNamePrefix('app-toolbar.')
export class AppToolbar {
  private elements = {
    container: document.createElement('div'),
    btn: {
      dataSources: document.createElement('div'),
      newDataSource: document.createElement('div'),
      search: document.createElement('div'),
      traces: document.createElement('div'),
      settings: document.createElement('div')
    },
    tracesBadgeCount: document.createElement('div'),
    tracesMenuListEmpty: document.createElement('div'),
    dataSourceMenuList: {
      header: document.createElement('div'),
      empty: document.createElement('div'),
      removePopConfirmContainer: document.createElement('div'),
      removePopConfirmButton: document.createElement('button')
    }
  };
  private tippyInstaces: {
    dataSources: TippyInstance;
    traces: TippyInstance;
    dataSourceRemovePopConfirm: TippyInstance;
  };
  private dataSourceFormModalContent: DataSourceFormModalContent;

  private binded = {
    onDataSourceManagerAdded: this.onDataSourceManagerAdded.bind(this),
    onDataSourceManagerUpdated: this.onDataSourceManagerUpdated.bind(this),
    onDataSourceManagerRemoved: this.onDataSourceManagerRemoved.bind(this),
    onDataSourceMenuListButtonClick: this.onDataSourceMenuListButtonClick.bind(
      this
    ),
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    onTracesMenuListButtonClick: this.onTracesMenuListButtonClick.bind(this),
    onNewDataSourceButtonClick: this.onNewDataSourceButtonClick.bind(this),
    onNewDataSourceModalClose: this.onNewDataSourceModalClose.bind(this),
    onDataSourceRemovePopConfirmButtonClick: this.onDataSourceRemovePopConfirmButtonClick.bind(
      this
    )
  };

  private stage = Stage.getSingleton();
  private dsManager = DataSourceManager.getSingleton();

  private dataSourcesMenuList = new ToolbarMenuList({
    headerEl: this.elements.dataSourceMenuList.header,
    emptyEl: this.elements.dataSourceMenuList.empty,
    items: [],
    onButtonClick: this.binded.onDataSourceMenuListButtonClick
  });
  private tracesMenuList = new ToolbarMenuList({
    emptyEl: this.elements.tracesMenuListEmpty,
    items: [],
    onButtonClick: this.binded.onTracesMenuListButtonClick
  });

  constructor(private options: AppToolbarOptions) {
    const { container: el, btn } = this.elements;
    el.id = 'app-toolbar';
    el.classList.add('app-toolbar');

    // Panes
    const leftPane = document.createElement('div');
    leftPane.classList.add('app-toolbar-pane');
    el.appendChild(leftPane);

    const middlePane = document.createElement('div');
    middlePane.classList.add('app-toolbar-pane');
    el.appendChild(middlePane);

    const rightPane = document.createElement('div');
    rightPane.classList.add('app-toolbar-pane');
    el.appendChild(rightPane);

    // Left buttons
    const divider = document.createElement('div');
    divider.classList.add('app-toolbar-divider');
    leftPane.appendChild(divider);

    btn.dataSources.classList.add('app-toolbar-button');
    btn.dataSources.innerHTML = SvgDatabase;
    leftPane.appendChild(btn.dataSources);

    btn.search.classList.add('app-toolbar-button', 'search');
    btn.search.innerHTML = SvgMagnify;
    leftPane.appendChild(btn.search);

    btn.traces.classList.add('app-toolbar-button', 'traces');
    btn.traces.innerHTML = SvgSourceBranch;
    leftPane.appendChild(btn.traces);

    // Right buttons
    btn.settings.classList.add('app-toolbar-button');
    btn.settings.innerHTML = SvgSettings;
    rightPane.appendChild(btn.settings);
  }

  @Stalk({ handler: ChildOf })
  init(ctx: opentracing.Span) {
    this.initTooltips(ctx);
    this.initTippyInstances(ctx);
    this.initTracesBadgeCount();

    // Prepare dataSource menu list header
    this.elements.dataSourceMenuList.header.classList.add(
      'toolbar-data-sources-menu-header'
    );

    const dsHeaderText = document.createElement('span');
    dsHeaderText.textContent = 'Data Sources';
    this.elements.dataSourceMenuList.header.appendChild(dsHeaderText);

    this.elements.btn.newDataSource.innerHTML = SvgPlus;
    this.elements.btn.newDataSource.addEventListener(
      'click',
      this.binded.onNewDataSourceButtonClick,
      false
    );
    this.elements.dataSourceMenuList.header.appendChild(
      this.elements.btn.newDataSource
    );

    // Prepare dataSource menu list empty
    this.elements.dataSourceMenuList.empty.classList.add(
      'toolbar-data-sources-menu-empty'
    );
    this.elements.dataSourceMenuList.empty.innerHTML = `<span class="heading">No Data Sources</span>
      <span class="description">Click ${SvgPlus} button on the top right to add a data source.</span>`;

    // Prepare traces menu list empty
    this.elements.tracesMenuListEmpty.classList.add(
      'toolbar-traces-menu-empty'
    );
    this.elements.tracesMenuListEmpty.innerHTML = `<span class="heading">No Traces in the Stage</span>
      <span class="description">You can search and add traces by clicking ${SvgMagnify} button on the left,
      or you can drag & drop Jaeger or Zipkin traces in JSON format.</span>`;

    // Data source remove pop confirm
    const {
      removePopConfirmContainer,
      removePopConfirmButton
    } = this.elements.dataSourceMenuList;
    removePopConfirmContainer.classList.add('datasource-remove-popconfirm');
    removePopConfirmContainer.innerHTML = `<div class="text">Are you sure to delete this data source?</div>`;
    removePopConfirmButton.textContent = 'Delete';
    removePopConfirmContainer.appendChild(removePopConfirmButton);
    removePopConfirmButton.addEventListener(
      'click',
      this.binded.onDataSourceRemovePopConfirmButtonClick,
      false
    );

    // Prepare datasource lists
    this.updateDataSourceList(ctx);

    // Bind events
    this.bindEvents();
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.elements.container);
  }

  unmount() {
    const el = this.elements.container;
    el.parentElement?.removeChild(el);
  }

  @Stalk({ handler: ChildOf })
  private initTooltips(ctx: opentracing.Span) {
    const tooltipManager = TooltipManager.getSingleton();
    tooltipManager.addToSingleton([
      [
        this.elements.btn.dataSources,
        {
          content: 'Data Sources',
          multiple: true
        }
      ],
      [this.elements.btn.search, { content: 'Search Traces' }],
      [
        this.elements.btn.traces,
        {
          content: 'Traces in the Stage',
          multiple: true
        }
      ],
      [this.elements.btn.settings, { content: 'Settings' }]
    ]);
  }

  @Stalk({ handler: ChildOf })
  private initTippyInstances(ctx: opentracing.Span) {
    this.tippyInstaces = {
      dataSources: tippy(this.elements.btn.dataSources, {
        content: this.dataSourcesMenuList.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        duration: 0,
        updateDuration: 0,
        theme: 'app-toolbar-menu-list',
        trigger: 'click',
        interactive: true
      }),
      traces: tippy(this.elements.btn.traces, {
        content: this.tracesMenuList.element,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        duration: 0,
        updateDuration: 0,
        theme: 'app-toolbar-menu-list',
        trigger: 'click',
        interactive: true
      }),
      dataSourceRemovePopConfirm: tippy(document.body, {
        lazy: false,
        duration: 0,
        updateDuration: 0,
        trigger: 'custom',
        arrow: true,
        content: this.elements.dataSourceMenuList.removePopConfirmContainer,
        appendTo: this.dataSourcesMenuList.element,
        multiple: true,
        interactive: true,
        placement: 'right',
        theme: 'app-toolbar-menu-list',
        onCreate(instance) {
          instance.popperInstance.reference = {
            clientWidth: 0,
            clientHeight: 0,
            getBoundingClientRect() {
              return {
                width: 0,
                height: 0,
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
              };
            }
          };
        }
      })
    };
  }

  private initTracesBadgeCount() {
    const el = this.elements.tracesBadgeCount;
    el.classList.add('toolbar-traces-badge-count');
  }

  //////////////////////////////////////
  //////////// VIEW UPDATES ////////////
  //////////////////////////////////////

  @Stalk({ handler: ChildOf })
  private updateDataSourceList(ctx: opentracing.Span) {
    this.dataSourcesMenuList.removeAllItems();
    const dataSources = this.dsManager.getAll();
    ctx.addTags({ dsCount: dataSources.length });
    dataSources.forEach(ds => {
      this.dataSourcesMenuList.addItem({
        text: ds.name,
        buttons: [
          { id: 'search', icon: 'magnify' },
          { id: 'edit', icon: 'pencil' },
          { id: 'delete', icon: 'delete' }
        ]
      });
    });
  }

  private updateTracesList() {
    this.tracesMenuList.removeAllItems();
    const traces = this.stage.getAllTraces();
    traces.forEach(trace => {
      this.tracesMenuList.addItem({
        text: trace.name,
        buttons: [{ id: 'remove', icon: 'close' }]
      });
    });
    this.updateTracesBadgeCount(traces.length);
  }

  updateTracesBadgeCount(count: number) {
    const el = this.elements.tracesBadgeCount;
    if (count > 0) {
      el.textContent = count + '';
      !el.parentElement && this.elements.btn.traces.appendChild(el);
    } else {
      el.parentElement?.removeChild(el);
    }
  }

  ///////////////////////////////////////////////
  ////////////////// EVENTS /////////////////////
  ///////////////////////////////////////////////

  private bindEvents() {
    const { btn } = this.elements;
    this.dsManager.on(
      DataSourceManagerEvent.ADDED,
      this.binded.onDataSourceManagerAdded
    );
    this.dsManager.on(
      DataSourceManagerEvent.UPDATED,
      this.binded.onDataSourceManagerUpdated
    );
    this.dsManager.on(
      DataSourceManagerEvent.REMOVED,
      this.binded.onDataSourceManagerRemoved
    );
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onStageTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onStageTraceRemoved);
  }

  private unbindEvents() {
    const { btn } = this.elements;
    this.dsManager.removeListener(
      DataSourceManagerEvent.ADDED,
      this.binded.onDataSourceManagerAdded
    );
    this.dsManager.removeListener(
      DataSourceManagerEvent.UPDATED,
      this.binded.onDataSourceManagerUpdated
    );
    this.dsManager.removeListener(
      DataSourceManagerEvent.REMOVED,
      this.binded.onDataSourceManagerRemoved
    );
    this.stage.removeListener(
      StageEvent.TRACE_ADDED,
      this.binded.onStageTraceAdded
    );
    this.stage.removeListener(
      StageEvent.TRACE_REMOVED,
      this.binded.onStageTraceRemoved
    );
    btn.newDataSource.removeEventListener(
      'click',
      this.binded.onNewDataSourceButtonClick,
      false
    );
    this.elements.dataSourceMenuList.removePopConfirmButton.removeEventListener(
      'click',
      this.binded.onDataSourceRemovePopConfirmButtonClick,
      false
    );
  }

  private async onDataSourceMenuListButtonClick(
    buttonId: string,
    index: number
  ) {
    const ds = this.dsManager.getAll()[index];
    if (!ds) {
      console.error(`Data source not found at index: ${index}`);
      return;
    }

    switch (buttonId) {
      case 'add-to-stage': {
        const api = this.dsManager.apiFor(ds);
        const result = await api.search({} as any);
        const traces = result.data.map(spans => new Trace(spans));
        // Add all of the traces
        traces.forEach(trace => this.stage.addTrace(null, trace));
        this.tippyInstaces.dataSources.hide();
        return;
      }

      case 'edit': {
        this.dataSourceFormModalContent = new DataSourceFormModalContent({
          type: 'edit',
          dataSource: ds
        });
        const modal = new Modal({
          content: this.dataSourceFormModalContent.getElement(),
          onClose: this.binded.onNewDataSourceModalClose
        });
        this.dataSourceFormModalContent.init();
        ModalManager.getSingleton().show(modal);
        this.tippyInstaces.dataSources.hide();

        return;
      }

      case 'delete': {
        const menuItem = this.dataSourcesMenuList.getItems()[index];
        const itemBBRect = menuItem.element.getBoundingClientRect();
        const parentMenuBBRect = this.dataSourcesMenuList.element.getBoundingClientRect();
        const tippyIns = this.tippyInstaces.dataSourceRemovePopConfirm;
        Object.assign(tippyIns.popperInstance.reference, {
          clientWidth: 0,
          clientHeight: 0,
          getBoundingClientRect: () => {
            return {
              width: itemBBRect.width,
              height: itemBBRect.height,
              top: itemBBRect.top - parentMenuBBRect.top,
              bottom: itemBBRect.bottom - parentMenuBBRect.top,
              left: itemBBRect.left,
              right: itemBBRect.right
            };
          }
        });
        tippyIns.popperInstance.update();
        tippyIns.show();
        this.elements.dataSourceMenuList.removePopConfirmButton.setAttribute(
          'data-datasource-id',
          ds.id
        );

        return;
      }

      default: {
        console.error(`Unknown data source menu list button id: "${buttonId}"`);
      }
    }
  }

  private onDataSourceRemovePopConfirmButtonClick(e: MouseEvent) {
    const dsId = (e.target as any).getAttribute('data-datasource-id');
    this.dsManager.remove(undefined, dsId);
    this.tippyInstaces.dataSourceRemovePopConfirm.hide();
  }

  @Stalk({ handler: FollowsFrom })
  private onDataSourceManagerAdded(
    ctx: opentracing.Span,
    dataSource: DataSource
  ) {
    this.updateDataSourceList(ctx);
  }

  @Stalk({ handler: FollowsFrom })
  private onDataSourceManagerUpdated(
    ctx: opentracing.Span,
    dataSource: DataSource
  ) {
    this.updateDataSourceList(ctx);
  }

  @Stalk({ handler: FollowsFrom })
  private onDataSourceManagerRemoved(
    ctx: opentracing.Span,
    dataSource: DataSource
  ) {
    this.updateDataSourceList(ctx);
  }

  @Stalk({ handler: FollowsFrom })
  private onStageTraceAdded(ctx: opentracing.Span, trace: Trace) {
    this.updateTracesList();
  }

  @Stalk({ handler: FollowsFrom })
  private onStageTraceRemoved(ctx: opentracing.Span, trace: Trace) {
    this.updateTracesList();
  }

  private onTracesMenuListButtonClick(
    item: ToolbarMenuListOptions,
    index: number
  ) {
    const trace = this.stage.getAllTraces()[index];
    if (!trace) return;
    this.stage.removeTrace(null, trace.id);
    this.tippyInstaces.traces.hide();
  }

  private onNewDataSourceButtonClick() {
    this.dataSourceFormModalContent = new DataSourceFormModalContent({
      type: 'new'
    });
    const modal = new Modal({
      content: this.dataSourceFormModalContent.getElement(),
      onClose: this.binded.onNewDataSourceModalClose
    });
    this.dataSourceFormModalContent.init();
    ModalManager.getSingleton().show(modal);
    this.tippyInstaces.dataSources.hide();
  }

  private async onNewDataSourceModalClose(
    triggerType: ModalCloseTriggerType,
    data: any
  ) {
    if (this.dataSourceFormModalContent) {
      this.dataSourceFormModalContent.dispose();
      this.dataSourceFormModalContent = null;
    }

    if (
      triggerType != ModalCloseTriggerType.CLOSE_METHOD_CALL ||
      data.action != 'save'
    ) {
      return;
    }

    if (data.dataSource.id) {
      // Editing already existing ds
      await this.dsManager.update(undefined, data.dataSource);
    } else {
      // Creating a new ds
      data.dataSource.id = shortid.generate();
      await this.dsManager.add(undefined, data.dataSource);
    }
  }

  dispose() {
    const tooltipManager = TooltipManager.getSingleton();
    tooltipManager.removeFromSingleton([
      this.elements.btn.dataSources,
      this.elements.btn.search,
      this.elements.btn.traces,
      this.elements.btn.settings
    ]);
    for (let tippy of Object.values(this.tippyInstaces)) {
      tippy.destroy();
    }
    this.tippyInstaces = null;
    this.unbindEvents();
    this.elements = null;
    this.options = null;
  }
}
