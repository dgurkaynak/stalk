import { DataSourceType, DataSource } from '../../model/datasource/interfaces';
import { ModalManager } from '../ui/modal/modal-manager';
import Noty from 'noty';
import JaegerAPI from '../../model/api/jaeger/api';

import './jaeger-search-modal-content.css';

export interface JaegerSearchModalContentOptions {
  api: JaegerAPI;
}

export class JaegerSearchModalContent {
  private elements = {
    container: document.createElement('div')
  };

  private binded = {};

  constructor(private options: JaegerSearchModalContentOptions) {
    // Prepare DOM
    const els = this.elements;
    els.container.classList.add('jaeger-search-modal-content');
  }

  init() {}

  getElement() {
    return this.elements.container;
  }

  dispose() {}
}
