import { DataSourceType, DataSource } from '../../model/datasource/interfaces';
import { ModalManager } from '../ui/modal/modal-manager';
import Noty from 'noty';
import { JaegerAPI } from '../../model/jaeger';
import tippy, { Instance as TippyInstance } from 'tippy.js';

import SvgCircleMedium from '!!raw-loader!@mdi/svg/svg/circle-small.svg';
import SvgCheckCircle from '!!raw-loader!@mdi/svg/svg/check-circle.svg';
import SvgAlertCircle from '!!raw-loader!@mdi/svg/svg/alert-circle.svg';
import './jaeger-search-modal-content.css';

export interface JaegerSearchModalContentOptions {
  dataSource: DataSource;
  api: JaegerAPI;
}

export class JaegerSearchModalContent {
  private elements = {
    container: document.createElement('div'),
    statusContainer: document.createElement('span'),
    statusContent: document.createElement('div')
  };

  private tippyInstaces: {
    status: TippyInstance;
  };

  private binded = {};

  constructor(private options: JaegerSearchModalContentOptions) {
    // Prepare DOM
    const els = this.elements;
    els.container.classList.add('jaeger-search-modal-content');

    const leftContainer = document.createElement('div');
    leftContainer.classList.add('left');
    els.container.appendChild(leftContainer);

    const rightContainer = document.createElement('div');
    rightContainer.classList.add('right');
    els.container.appendChild(rightContainer);

    // Left container
    const headerContainer = document.createElement('div');
    headerContainer.classList.add('header');
    leftContainer.appendChild(headerContainer);

    const title = document.createElement('span');
    title.classList.add('title');
    title.textContent = this.options.dataSource.name;
    headerContainer.appendChild(title);

    els.statusContainer.classList.add('status');
    headerContainer.appendChild(els.statusContainer);

    // Right container
  }

  init() {
    this.initTippyInstances();
    this.testApiAndUpdateStatus();
  }

  private initTippyInstances() {
    this.tippyInstaces = {
      status: tippy(this.elements.statusContainer, {
        delay: 0,
        duration: 0,
        updateDuration: 0,
        content: this.elements.statusContent,
        theme: 'tooltip',
        placement: 'top'
      })
    };
  }

  async testApiAndUpdateStatus() {
    const els = this.elements;

    els.statusContainer.classList.remove('success', 'error');
    els.statusContainer.innerHTML = SvgCircleMedium;
    els.statusContent.textContent = 'Testing the API...';

    try {
      await this.options.api.test();

      els.statusContainer.classList.add('success');
      els.statusContainer.innerHTML = SvgCheckCircle;
      els.statusContent.textContent = 'API is OK';
    } catch (err) {
      els.statusContainer.classList.add('error');
      els.statusContainer.innerHTML = SvgAlertCircle;
      els.statusContent.textContent = err.message;
    }
  }

  getElement() {
    return this.elements.container;
  }

  dispose() {}
}
