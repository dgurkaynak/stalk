import { DataSourceType, DataSource } from '../../model/datasource/interfaces';
import { ModalManager } from '../ui/modal/modal-manager';
import Noty from 'noty';
import JaegerAPI from '../../model/api/jaeger/api';
import ZipkinAPI from '../../model/api/zipkin/api';

import './form-modal-content.css';

export interface DataSourceFormModalContentOptions {
  type: 'new' | 'edit';
  dataSource?: DataSource;
}

export class DataSourceFormModalContent {
  private elements = {
    container: document.createElement('div'),
    formContainer: document.createElement('div'),
    form: {
      typeSelect: document.createElement('select'),
      nameInput: document.createElement('input'),
      baseUrlInput: document.createElement('input'),
      basicAuthCheckbox: document.createElement('input'),
      usernameRow: document.createElement('div'),
      usernameInput: document.createElement('input'),
      passwordRow: document.createElement('div'),
      passwordInput: document.createElement('input')
    },
    cancelButton: document.createElement('button'),
    saveButton: document.createElement('button'),
    testButton: document.createElement('button')
  };

  private binded = {
    onCancelButtonClick: this.onCancelButtonClick.bind(this),
    onSaveButtonClick: this.onSaveButtonClick.bind(this),
    onTestButtonClick: this.onTestButtonClick.bind(this),
    onBasicAuthCheckboxChange: this.onBasicAuthCheckboxChange.bind(this),
    onTypeSelectChange: this.onTypeSelectChange.bind(this)
  };

  constructor(private options: DataSourceFormModalContentOptions) {
    // Prepare DOM
    const els = this.elements;
    els.container.classList.add('datasource-form-modal-content');

    els.formContainer.classList.add('form-container');
    els.container.appendChild(els.formContainer);
    this.initForm();

    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('buttons');
    els.container.appendChild(buttonsContainer);

    const leftButtons = document.createElement('div');
    leftButtons.classList.add('left');
    buttonsContainer.appendChild(leftButtons);

    const rightButtons = document.createElement('div');
    rightButtons.classList.add('right');
    buttonsContainer.appendChild(rightButtons);

    els.cancelButton.classList.add('cancel');
    els.cancelButton.textContent = 'Cancel';
    leftButtons.appendChild(els.cancelButton);

    els.testButton.classList.add('test');
    els.testButton.textContent = 'Test';
    rightButtons.appendChild(els.testButton);

    els.saveButton.classList.add('save');
    els.saveButton.textContent = 'Save';
    rightButtons.appendChild(els.saveButton);
  }

  init() {
    this.elements.cancelButton.addEventListener(
      'click',
      this.binded.onCancelButtonClick,
      false
    );
    this.elements.testButton.addEventListener(
      'click',
      this.binded.onTestButtonClick,
      false
    );
    this.elements.saveButton.addEventListener(
      'click',
      this.binded.onSaveButtonClick,
      false
    );

    // TODO: Fill the form
  }

  getElement() {
    return this.elements.container;
  }

  private onCancelButtonClick() {
    const modal = ModalManager.getSingleton().findModalFromElement(
      this.elements.container
    );
    if (!modal) throw new Error(`Could not find modal instance`);
    modal.close({ data: { action: 'cancel' } });
  }

  private async onSaveButtonClick() {
    // TODO: Form validation

    const modal = ModalManager.getSingleton().findModalFromElement(
      this.elements.container
    );
    if (!modal) throw new Error(`Could not find modal instance`);

    const formEl = this.elements.form;
    const dataSource: DataSource = {
      id: this.options.dataSource?.id,
      type: formEl.typeSelect.value,
      name: formEl.nameInput.value.trim(),
      baseUrl: formEl.baseUrlInput.value.trim(),
      username: formEl.usernameInput.value,
      password: formEl.passwordInput.value
    };

    modal.close({ data: { action: 'save', dataSource } });
  }

  private async onTestButtonClick() {
    // TODO: Form validation

    try {
      await this.test();
      new Noty({
        text: 'Data source is working',
        type: 'success',
        timeout: 2500
      }).show();
    } catch (err) {
      new Noty({
        text: `Error: ${err.message || ''}`, // TODO
        type: 'error',
        timeout: 2500
      }).show();
    }
  }

  private async test() {
    const formEl = this.elements.form;
    const options = {
      baseUrl: formEl.baseUrlInput.value,
      username: formEl.usernameInput.value,
      password: formEl.passwordInput.value
    };

    const api =
      formEl.typeSelect.value == DataSourceType.JAEGER
        ? new JaegerAPI(options)
        : new ZipkinAPI(options);

    return api.test();
  }

  private initForm() {
    const formEl = this.elements.form;
    const titleText =
      this.options.type == 'new' ? 'New Data Source' : 'Edit Data Source';
    const isBasicAuthEnabled =
      this.options.dataSource?.username || this.options.dataSource?.password;

    this.elements.formContainer.innerHTML = `<h2>${titleText}</h2>`;

    // Type
    const typeRow = document.createElement('div');
    typeRow.classList.add('form-row');
    typeRow.innerHTML = `<div>Type:</div>`;
    formEl.typeSelect.innerHTML = `<option value="${DataSourceType.JAEGER}">Jaeger</option>
      <option value="${DataSourceType.ZIPKIN}">Zipkin</option>`;
    if (this.options.dataSource?.type) {
      formEl.typeSelect.value = this.options.dataSource.type;
    }
    typeRow.appendChild(formEl.typeSelect);
    this.elements.formContainer.appendChild(typeRow);
    formEl.typeSelect.addEventListener(
      'change',
      this.binded.onTypeSelectChange,
      false
    );

    // Name
    const nameRow = document.createElement('div');
    nameRow.classList.add('form-row');
    nameRow.innerHTML = `<div>Name:</div>`;
    formEl.nameInput.type = 'text';
    formEl.nameInput.required = true;
    formEl.nameInput.placeholder = 'My data source';
    if (this.options.dataSource?.name) {
      formEl.nameInput.value = this.options.dataSource.name;
    }
    nameRow.appendChild(formEl.nameInput);
    this.elements.formContainer.appendChild(nameRow);

    // Base url
    const baseUrlRow = document.createElement('div');
    baseUrlRow.classList.add('form-row');
    baseUrlRow.innerHTML = `<div>API Base URL:</div>`;
    formEl.baseUrlInput.type = 'text';
    formEl.baseUrlInput.required = true;
    formEl.baseUrlInput.placeholder = 'http://0.0.0.0:16686';
    if (this.options.dataSource?.baseUrl) {
      formEl.baseUrlInput.value = this.options.dataSource.baseUrl;
    }
    baseUrlRow.appendChild(formEl.baseUrlInput);
    this.elements.formContainer.appendChild(baseUrlRow);

    // Basic auth
    const basicAuthRow = document.createElement('div');
    basicAuthRow.classList.add('form-row');
    basicAuthRow.innerHTML = `<div>Basic Authentication:</div>`;
    formEl.basicAuthCheckbox.type = 'checkbox';
    if (isBasicAuthEnabled) {
      formEl.basicAuthCheckbox.checked = true;
    }
    basicAuthRow.appendChild(formEl.basicAuthCheckbox);
    this.elements.formContainer.appendChild(basicAuthRow);
    formEl.basicAuthCheckbox.addEventListener(
      'change',
      this.binded.onBasicAuthCheckboxChange,
      false
    );

    // Username
    formEl.usernameRow.classList.add('form-row');
    formEl.usernameRow.innerHTML = `<div>Userame:</div>`;
    formEl.usernameInput.type = 'text';
    if (this.options.dataSource?.username) {
      formEl.usernameInput.value = this.options.dataSource.username;
    }
    formEl.usernameRow.appendChild(formEl.usernameInput);
    this.elements.formContainer.appendChild(formEl.usernameRow);
    if (!isBasicAuthEnabled) {
      formEl.usernameRow.style.display = 'none';
    }

    // Password
    formEl.passwordRow.classList.add('form-row');
    formEl.passwordRow.innerHTML = `<div>Password:</div>`;
    formEl.passwordInput.type = 'password';
    if (this.options.dataSource?.password) {
      formEl.passwordInput.value = this.options.dataSource.password;
    }
    formEl.passwordRow.appendChild(formEl.passwordInput);
    this.elements.formContainer.appendChild(formEl.passwordRow);
    if (!isBasicAuthEnabled) {
      formEl.passwordRow.style.display = 'none';
    }
  }

  private onBasicAuthCheckboxChange() {
    const formEl = this.elements.form;

    if (formEl.basicAuthCheckbox.checked) {
      formEl.usernameRow.style.display = '';
      formEl.passwordRow.style.display = '';
    } else {
      formEl.usernameRow.style.display = 'none';
      formEl.passwordRow.style.display = 'none';
      formEl.usernameInput.value = '';
      formEl.passwordInput.value = '';
    }
  }

  private onTypeSelectChange() {
    const formEl = this.elements.form;

    if (formEl.typeSelect.value == DataSourceType.JAEGER) {
      formEl.baseUrlInput.placeholder = 'http://0.0.0.0:16686';
    }

    if (formEl.typeSelect.value == DataSourceType.ZIPKIN) {
      formEl.baseUrlInput.placeholder = 'http://0.0.0.0:9411';
    }
  }

  dispose() {
    this.elements.cancelButton.removeEventListener(
      'click',
      this.binded.onCancelButtonClick,
      false
    );
    this.elements.testButton.removeEventListener(
      'click',
      this.binded.onTestButtonClick,
      false
    );
    this.elements.saveButton.removeEventListener(
      'click',
      this.binded.onSaveButtonClick,
      false
    );
    this.elements.form.basicAuthCheckbox.removeEventListener(
      'change',
      this.binded.onBasicAuthCheckboxChange,
      false
    );
    this.elements.form.typeSelect.removeEventListener(
      'change',
      this.binded.onTypeSelectChange,
      false
    );
  }
}
