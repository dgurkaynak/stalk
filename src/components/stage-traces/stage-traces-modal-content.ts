import { ModalManager } from '../ui/modal/modal-manager';
import {
  StageTracesTableView,
  StageTracesTableViewEvent,
  StageTraceRowData,
} from './stage-traces-table';
import throttle from 'lodash/throttle';
import { Stage, StageEvent } from '../../model/stage';

import './stage-traces-modal-content.css';

export class StageTracesModalContent {
  private stage = Stage.getSingleton();
  private tracesTable = new StageTracesTableView();
  private selectedTraceIds: string[] = [];
  private elements = {
    container: document.createElement('div'),
    topContainer: document.createElement('div'),
    tracesTablePlaceholder: {
      container: document.createElement('div'),
      text: document.createElement('span'),
    },
    bottom: {
      container: document.createElement('div'),
      selectionText: document.createElement('div'),
      removeFromStageButton: document.createElement('button'),
      removeAllButton: document.createElement('button'),
    },
  };
  inited = false;

  private binded = {
    onWindowResize: throttle(this.onWindowResize.bind(this), 100),
    onTableSelectionUpdated: this.onTableSelectionUpdated.bind(this),
    onRemoveFromStageButtonClick: this.onRemoveFromStageButtonClick.bind(this),
    onRemoveAllButtonClick: this.onRemoveAllButtonClick.bind(this),
    onTraceAdded: this.onTraceAdded.bind(this),
    onTraceRemoved: this.onTraceRemoved.bind(this),
  };

  constructor() {
    // Prepare DOM
    const els = this.elements;
    els.container.classList.add('stage-traces-modal-content');

    els.topContainer.classList.add('top');
    els.container.appendChild(els.topContainer);

    els.bottom.container.classList.add('bottom');
    els.container.appendChild(els.bottom.container);

    // Table placeholder
    const elsTP = els.tracesTablePlaceholder;
    elsTP.container.classList.add('tabulator-placeholder');
    elsTP.text.textContent = 'No traces in the stage';
    elsTP.container.appendChild(elsTP.text);

    // Bottom
    {
      const leftContainer = document.createElement('div');
      leftContainer.classList.add('left');
      els.bottom.container.appendChild(leftContainer);

      const rightContainer = document.createElement('div');
      rightContainer.classList.add('right');
      els.bottom.container.appendChild(rightContainer);

      els.bottom.selectionText.innerHTML = 'No trace selected';
      rightContainer.appendChild(els.bottom.selectionText);

      els.bottom.removeFromStageButton.textContent = 'Remove from Stage';
      els.bottom.removeFromStageButton.disabled = true;
      rightContainer.appendChild(els.bottom.removeFromStageButton);

      els.bottom.removeAllButton.textContent = 'Clear the Stage';
      els.bottom.removeAllButton.disabled =
        this.stage.getAllTraces().length == 0;
      leftContainer.appendChild(els.bottom.removeAllButton);
    }
  }

  init() {
    // Bind events
    this.tracesTable.on(
      StageTracesTableViewEvent.SELECTIONS_UPDATED,
      this.binded.onTableSelectionUpdated
    );
    this.elements.bottom.removeFromStageButton.addEventListener(
      'click',
      this.binded.onRemoveFromStageButtonClick,
      false
    );
    this.elements.bottom.removeAllButton.addEventListener(
      'click',
      this.binded.onRemoveAllButtonClick,
      false
    );
    this.stage.on(StageEvent.TRACE_ADDED, this.binded.onTraceAdded);
    this.stage.on(StageEvent.TRACE_REMOVED, this.binded.onTraceRemoved);
    window.addEventListener('resize', this.binded.onWindowResize, false);

    // Update remove all button
    this.elements.bottom.removeAllButton.disabled =
      this.stage.getAllTraces().length == 0;

    // Traces table
    // In order to get offsetWidth and height, the dom must be rendered
    // So before calling this `init()` method, ensure that dom is rendered.
    this.tracesTable.mount(this.elements.topContainer);
    const { offsetWidth: w, offsetHeight: h } = this.elements.topContainer;
    this.tracesTable.init({
      width: w,
      height: h,
      placeholderElement: this.elements.tracesTablePlaceholder.container,
    });
    this.inited = true;
  }

  onShow() {
    const { offsetWidth: w, offsetHeight: h } = this.elements.topContainer;
    this.tracesTable.resize(w, h);
    this.tracesTable.redrawTable(true);
  }

  private onWindowResize() {
    const { offsetWidth: w, offsetHeight: h } = this.elements.topContainer;
    this.tracesTable.resize(w, h);
  }

  private async onTableSelectionUpdated(selectedTraces: StageTraceRowData[]) {
    // When we try to redraw tabulator while it's already redrawing,
    // it gives an error. So, we apply the most famous javascript workaround ever.
    // await new Promise(resolve => setTimeout(resolve, 0));
    this.selectedTraceIds = selectedTraces.map((t) => t.id);

    if (selectedTraces.length == 0) {
      this.elements.bottom.removeFromStageButton.disabled = true;
      this.elements.bottom.selectionText.textContent = 'No trace selected';
      return;
    }

    let text = `${selectedTraces.length} traces`;
    if (selectedTraces.length == 1) {
      text = `1 trace`;
    }
    this.elements.bottom.selectionText.innerHTML = `<strong>${text}</strong> selected`;
    this.elements.bottom.removeFromStageButton.disabled = false;
  }

  private onRemoveFromStageButtonClick() {
    const modal = ModalManager.getSingleton().findModalFromElement(
      this.elements.container
    );
    if (!modal) throw new Error(`Could not find modal instance`);
    modal.close({
      data: { action: 'removeFromStage', traceIds: this.selectedTraceIds },
    });

    this.tracesTable.deselectAll();
  }

  private onTraceAdded() {
    this.elements.bottom.removeAllButton.disabled =
      this.stage.getAllTraces().length == 0;
  }

  private onTraceRemoved() {
    this.elements.bottom.removeAllButton.disabled =
      this.stage.getAllTraces().length == 0;
  }

  private onRemoveAllButtonClick() {
    const modal = ModalManager.getSingleton().findModalFromElement(
      this.elements.container
    );
    if (!modal) throw new Error(`Could not find modal instance`);
    modal.close({
      data: {
        action: 'removeFromStage',
        traceIds: this.stage.getAllTraces().map((t) => t.id),
      },
    });
  }

  getElement() {
    return this.elements.container;
  }

  dispose() {
    this.tracesTable.removeListener(
      StageTracesTableViewEvent.SELECTIONS_UPDATED,
      this.binded.onTableSelectionUpdated
    );
    this.elements.bottom.removeFromStageButton.removeEventListener(
      'click',
      this.binded.onRemoveFromStageButtonClick,
      false
    );
    this.elements.bottom.removeAllButton.removeEventListener(
      'click',
      this.binded.onRemoveAllButtonClick,
      false
    );
    this.stage.removeListener(StageEvent.TRACE_ADDED, this.binded.onTraceAdded);
    this.stage.removeListener(
      StageEvent.TRACE_REMOVED,
      this.binded.onTraceRemoved
    );
    window.removeEventListener('resize', this.binded.onWindowResize, false);

    this.tracesTable.dispose();
  }
}
