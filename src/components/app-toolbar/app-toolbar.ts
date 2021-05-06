import tippy, { Instance as TippyInstance } from 'tippy.js';
import { ToolbarMenuList } from './menu-list';
import {
  DataSourceManager,
  DataSourceManagerEvent,
} from '../../model/datasource/manager';
import { DataSource } from '../../model/datasource/interfaces';
import { Stage, StageEvent } from '../../model/stage';
import { Trace } from '../../model/trace';
import { TooltipManager } from '../ui/tooltip/tooltip-manager';
import { Modal, ModalCloseTriggerType } from '../ui/modal/modal';
import { ModalManager } from '../ui/modal/modal-manager';
import { DataSourceFormModalContent } from '../datasource/datasource-form-modal-content';
import shortid from 'shortid';
import { StageTracesModalContent } from '../stage-traces/stage-traces-modal-content';

import SvgPlus from '!!raw-loader!@mdi/svg/svg/plus.svg';
import SvgDatabase from '!!raw-loader!@mdi/svg/svg/database.svg';
import SvgSourceBranch from '!!raw-loader!@mdi/svg/svg/source-branch.svg';
import SvgSatellite from '!!raw-loader!@mdi/svg/svg/satellite-uplink.svg';
import SvgDeleteEmpty from '!!raw-loader!@mdi/svg/svg/delete-empty.svg';
import './app-toolbar.css';

export interface AppToolbarOptions {
  onDataSourceClick: (dataSource: DataSource) => void;
}

export class AppToolbar {
  private elements = {
    container: document.createElement('div'),
    btn: {
      dataSources: document.createElement('div'),
      newDataSource: document.createElement('div'),
      stageTraces: document.createElement('div'),
      clearStage: document.createElement('div'),
    },
    tracesBadgeCount: document.createElement('div'),
    dataSourceMenuList: {
      header: document.createElement('div'),
      empty: document.createElement('div'),
      removePopConfirmContainer: document.createElement('div'),
      removePopConfirmButton: document.createElement('button'),
    },
    clearStagePopConfirmContainer: document.createElement('div'),
    clearStagePopConfirmButton: document.createElement('button'),
  };
  private tippyInstaces: {
    dataSources: TippyInstance;
    dataSourceRemovePopConfirm: TippyInstance;
    clearStagePopConfirm: TippyInstance;
  };
  private dataSourceFormModalContent: DataSourceFormModalContent;
  private stageTracesModalContent = new StageTracesModalContent();

  private binded = {
    onDataSourceManagerAdded: this.onDataSourceManagerAdded.bind(this),
    onDataSourceManagerUpdated: this.onDataSourceManagerUpdated.bind(this),
    onDataSourceManagerRemoved: this.onDataSourceManagerRemoved.bind(this),
    onDataSourceMenuListButtonClick: this.onDataSourceMenuListButtonClick.bind(
      this
    ),
    onDataSourceMenuListTextClick: this.onDataSourceMenuListTextClick.bind(
      this
    ),
    onStageTraceAdded: this.onStageTraceAdded.bind(this),
    onStageTraceRemoved: this.onStageTraceRemoved.bind(this),
    onStageTracesButtonClick: this.onStageTracesButtonClick.bind(this),
    onNewDataSourceButtonClick: this.onNewDataSourceButtonClick.bind(this),
    onNewDataSourceModalClose: this.onNewDataSourceModalClose.bind(this),
    onDataSourceRemovePopConfirmButtonClick: this.onDataSourceRemovePopConfirmButtonClick.bind(
      this
    ),
    onDataSourceSearchModalClosed: this.onDataSourceSearchModalClosed.bind(
      this
    ),
    onStageTracesModalClose: this.onStageTracesModalClose.bind(this),
    onClearStagePopConfirmButtonClick: this.onClearStagePopConfirmButtonClick.bind(
      this
    ),
  };

  private stage = Stage.getSingleton();
  private dsManager = DataSourceManager.getSingleton();

  private dataSourcesMenuList = new ToolbarMenuList({
    headerEl: this.elements.dataSourceMenuList.header,
    emptyEl: this.elements.dataSourceMenuList.empty,
    items: [],
    onButtonClick: this.binded.onDataSourceMenuListButtonClick,
    onTextClick: this.binded.onDataSourceMenuListTextClick,
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

    // Right buttons
    btn.stageTraces.classList.add('app-toolbar-button', 'stage-traces');
    btn.stageTraces.innerHTML = SvgSourceBranch;
    rightPane.appendChild(btn.stageTraces);

    btn.clearStage.classList.add('app-toolbar-button', 'clear-stage');
    btn.clearStage.innerHTML = SvgDeleteEmpty;
    rightPane.appendChild(btn.clearStage);
  }

  init() {
    this.initTooltips();
    this.initTippyInstances();
    this.initBadgeCounts();

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

    // Data source remove pop confirm
    const {
      removePopConfirmContainer,
      removePopConfirmButton,
    } = this.elements.dataSourceMenuList;
    removePopConfirmContainer.classList.add('popconfirm');
    removePopConfirmContainer.innerHTML = `<div class="text">Are you sure to delete this data source?</div>`;
    removePopConfirmButton.classList.add('danger', 'small');
    removePopConfirmButton.textContent = 'Delete';
    removePopConfirmContainer.appendChild(removePopConfirmButton);
    removePopConfirmButton.addEventListener(
      'click',
      this.binded.onDataSourceRemovePopConfirmButtonClick,
      false
    );

    // Clear the stage pop confirm
    const {
      clearStagePopConfirmContainer,
      clearStagePopConfirmButton,
    } = this.elements;
    clearStagePopConfirmContainer.classList.add('popconfirm');
    clearStagePopConfirmContainer.innerHTML = `<div class="text">Are you sure to clear the stage?</div>`;
    clearStagePopConfirmButton.classList.add('danger', 'small');
    clearStagePopConfirmButton.textContent = 'Clear';
    clearStagePopConfirmContainer.appendChild(clearStagePopConfirmButton);
    clearStagePopConfirmButton.addEventListener(
      'click',
      this.binded.onClearStagePopConfirmButtonClick,
      false
    );

    // Prepare datasource lists
    this.updateDataSourceList();

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

  private initTooltips() {
    const tooltipManager = TooltipManager.getSingleton();
    tooltipManager.addToSingleton([
      [
        this.elements.btn.dataSources,
        {
          content: 'Data Sources',
          multiple: true,
        },
      ],
      [
        this.elements.btn.stageTraces,
        {
          content: 'Traces in the Stage',
          multiple: true,
        },
      ],
      [
        this.elements.btn.clearStage,
        {
          content: 'Clear the Stage',
          multiple: true,
        },
      ],
    ]);
  }

  private initTippyInstances() {
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
        interactive: true,
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
                right: 0,
              };
            },
          };
        },
      }),
      clearStagePopConfirm: tippy(this.elements.btn.clearStage, {
        content: this.elements.clearStagePopConfirmContainer,
        multiple: true,
        appendTo: document.body,
        placement: 'bottom',
        duration: 0,
        updateDuration: 0,
        theme: 'app-toolbar-menu-list',
        trigger: 'click',
        interactive: true,
      }),
    };
  }

  private initBadgeCounts() {
    const els = this.elements;
    els.tracesBadgeCount.classList.add('toolbar-badge-count', 'stage');
  }

  //////////////////////////////////////
  //////////// VIEW UPDATES ////////////
  //////////////////////////////////////

  private updateDataSourceList() {
    this.dataSourcesMenuList.removeAllItems();
    const dataSources = this.dsManager.getAll();
    dataSources.forEach((ds) => {
      this.dataSourcesMenuList.addItem({
        text: ds.name,
        buttons: [
          { id: 'edit', icon: 'pencil' },
          { id: 'delete', icon: 'delete' },
        ],
      });
    });
  }

  updateTracesBadgeCount(count: number) {
    const el = this.elements.tracesBadgeCount;
    if (count > 0) {
      el.textContent = count + '';
      !el.parentElement && this.elements.btn.stageTraces.appendChild(el);
    } else {
      el.parentElement?.removeChild(el);
    }
  }

  ///////////////////////////////////////////////
  ////////////////// EVENTS /////////////////////
  ///////////////////////////////////////////////

  private bindEvents() {
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
    this.elements.btn.stageTraces.addEventListener(
      'click',
      this.binded.onStageTracesButtonClick,
      false
    );
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
    this.elements.btn.stageTraces.removeEventListener(
      'click',
      this.binded.onStageTracesButtonClick,
      false
    );
    this.elements.clearStagePopConfirmButton.removeEventListener(
      'click',
      this.binded.onClearStagePopConfirmButtonClick,
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
      case 'edit': {
        this.dataSourceFormModalContent = new DataSourceFormModalContent({
          type: 'edit',
          dataSource: ds,
        });
        const modal = new Modal({
          content: this.dataSourceFormModalContent.getElement(),
          onClose: this.binded.onNewDataSourceModalClose,
          shouldAutoFocusFirstElement: true,
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
              left: itemBBRect.left - parentMenuBBRect.left,
              right: itemBBRect.right - parentMenuBBRect.left,
            };
          },
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

  private async onDataSourceMenuListTextClick(index: number) {
    this.showDataSourceSearchModal(index);
  }

  private async showDataSourceSearchModal(index: number) {
    const ds = this.dsManager.getAll()[index];
    if (!ds) {
      console.error(`Data source not found at index: ${index}`);
      return;
    }

    this.options.onDataSourceClick(ds);
    this.tippyInstaces.dataSources.hide();
  }

  private onDataSourceRemovePopConfirmButtonClick(e: MouseEvent) {
    const dsId = (e.target as any).getAttribute('data-datasource-id');
    this.dsManager.remove(dsId);
    this.tippyInstaces.dataSourceRemovePopConfirm.hide();

    window.Countly && window.Countly.add_event({
      key: 'data_source_removed',
      count: 1,
      segmentation: {},
    });
  }

  private onDataSourceManagerAdded(dataSource: DataSource) {
    this.updateDataSourceList();
  }

  private onDataSourceManagerUpdated(dataSource: DataSource) {
    this.updateDataSourceList();
  }

  private onDataSourceManagerRemoved(dataSource: DataSource) {
    this.updateDataSourceList();
  }

  private onStageTraceAdded(trace: Trace) {
    this.updateTracesBadgeCount(this.stage.getAllTraces().length);
  }

  private onStageTraceRemoved(trace: Trace) {
    this.updateTracesBadgeCount(this.stage.getAllTraces().length);
  }

  private onStageTracesButtonClick() {
    const modal = new Modal({
      content: this.stageTracesModalContent.getElement(),
      contentContainerClassName: 'stage-traces-modal-container',
      onClose: this.binded.onStageTracesModalClose,
      shouldCloseOnEscPress: true,
      shouldCloseOnOverlayClick: true,
    });
    ModalManager.getSingleton().show(modal);
    if (!this.stageTracesModalContent.inited)
      this.stageTracesModalContent.init();
    this.stageTracesModalContent.onShow();
  }

  private onStageTracesModalClose(
    triggerType: ModalCloseTriggerType,
    data: any
  ) {
    if (triggerType != ModalCloseTriggerType.CLOSE_METHOD_CALL) return;
    if (data?.action != 'removeFromStage') return;
    (data.traceIds as string[]).forEach((id) => this.stage.removeTrace(id));
  }

  private onClearStagePopConfirmButtonClick(e: MouseEvent) {
    this.stage.getAllTraces().forEach((t) => this.stage.removeTrace(t.id));
    this.tippyInstaces.clearStagePopConfirm.hide();
  }

  private onNewDataSourceButtonClick() {
    this.dataSourceFormModalContent = new DataSourceFormModalContent({
      type: 'new',
    });
    const modal = new Modal({
      content: this.dataSourceFormModalContent.getElement(),
      onClose: this.binded.onNewDataSourceModalClose,
      shouldAutoFocusFirstElement: true,
    });
    this.dataSourceFormModalContent.init();
    ModalManager.getSingleton().show(modal);
    this.tippyInstaces.dataSources.hide();

    window.Countly && window.Countly.add_event({
      key: 'new_data_source_modal_opened',
      count: 1,
      segmentation: {},
    });
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
      await this.dsManager.update(data.dataSource);
    } else {
      // Creating a new ds
      data.dataSource.id = shortid.generate();
      await this.dsManager.add(data.dataSource);

      window.Countly && window.Countly.add_event({
        key: 'new_data_source_added',
        count: 1,
        segmentation: {
          type: data.dataSource.type,
        },
      });
    }
  }

  private onDataSourceSearchModalClosed(
    triggerType: ModalCloseTriggerType,
    data: any
  ) {
    if (triggerType != ModalCloseTriggerType.CLOSE_METHOD_CALL) return;
    if (data?.action != 'addToStage') return;
    (data.traces as Trace[]).forEach((t) => this.stage.addTrace(t));
  }

  dispose() {
    const tooltipManager = TooltipManager.getSingleton();
    tooltipManager.removeFromSingleton([
      this.elements.btn.dataSources,
      this.elements.btn.stageTraces,
    ]);
    for (let tippy of Object.values(this.tippyInstaces)) {
      tippy.destroy();
    }
    this.tippyInstaces = null;

    this.unbindEvents();
    this.elements = null;
  }
}
