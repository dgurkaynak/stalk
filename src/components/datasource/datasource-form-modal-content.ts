import { DataSourceType, DataSource } from '../../model/datasource/interfaces';
import { ModalManager } from '../ui/modal/modal-manager';
import Noty from 'noty';
import { JaegerAPI } from '../../model/jaeger';
import { ZipkinAPI } from '../../model/zipkin';
import tippy, { Instance as TippyInstance } from 'tippy.js';

import SvgInformationOutline from '!!raw-loader!@mdi/svg/svg/information-outline.svg';
import './datasource-form-modal-content.css';

export interface DataSourceFormModalContentOptions {
  type: 'new' | 'edit';
  dataSource?: DataSource;
}

export class DataSourceFormModalContent {
  private elements = {
    container: document.createElement('div'),
    form: {
      container: document.createElement('form'),
      typeSelect: document.createElement('select'),
      nameInput: document.createElement('input'),
      baseUrlLabel: document.createElement('span'),
      baseUrlInfoIconContainer: document.createElement('span'),
      baseUrlInput: document.createElement('input'),
      basicAuthCheckbox: document.createElement('input'),
      usernameRow: document.createElement('div'),
      usernameInput: document.createElement('input'),
      passwordRow: document.createElement('div'),
      passwordInput: document.createElement('input'),
      cancelButton: document.createElement('button'),
      saveButton: document.createElement('button'),
      testButton: document.createElement('button'),
    },
  };
  private baseUrlInfoTooltipContent = document.createElement('span');
  private baseUrlInfoTooltipTippy: TippyInstance;

  private binded = {
    onCancelButtonClick: this.onCancelButtonClick.bind(this),
    onFormSubmit: this.onFormSubmit.bind(this),
    onTestButtonClick: this.onTestButtonClick.bind(this),
    onBasicAuthCheckboxChange: this.onBasicAuthCheckboxChange.bind(this),
    onTypeSelectChange: this.onTypeSelectChange.bind(this),
  };

  constructor(private options: DataSourceFormModalContentOptions) {
    // Prepare DOM
    const els = this.elements;
    els.container.classList.add('datasource-form-modal-content');

    els.form.container.classList.add('form-container');
    els.container.appendChild(els.form.container);
    this.initForm();
  }

  init() {
    this.elements.form.cancelButton.addEventListener(
      'click',
      this.binded.onCancelButtonClick,
      false
    );
    this.elements.form.testButton.addEventListener(
      'click',
      this.binded.onTestButtonClick,
      false
    );
    this.elements.form.container.addEventListener(
      'submit',
      this.binded.onFormSubmit,
      false
    );

    this.baseUrlInfoTooltipTippy = tippy(
      this.elements.form.baseUrlInfoIconContainer,
      {
        content: this.baseUrlInfoTooltipContent,
        multiple: true,
        placement: 'top',
        duration: 0,
        updateDuration: 0,
        maxWidth: '200px',
      }
    );
  }

  getElement() {
    return this.elements.container;
  }

  private onCancelButtonClick(e: Event) {
    e.preventDefault();

    const modal = ModalManager.getSingleton().findModalFromElement(
      this.elements.container
    );
    if (!modal) throw new Error(`Could not find modal instance`);
    modal.close({ data: { action: 'cancel' } });
  }

  private async onFormSubmit(e: Event) {
    e.preventDefault();

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
      password: formEl.passwordInput.value,
    };

    modal.close({ data: { action: 'save', dataSource } });
  }

  private async onTestButtonClick(e: Event) {
    e.preventDefault();

    try {
      await this.test();
      this.elements.form.saveButton.disabled = false;

      new Noty({
        text: 'Data source is working',
        type: 'success',
        timeout: 2500,
      }).show();
    } catch (err) {
      new Noty({
        text: `Error: ${err.message || ''}`,
        type: 'error',
        timeout: 2500,
      }).show();
    }
  }

  private async test() {
    const formEl = this.elements.form;
    const options = {
      baseUrl: formEl.baseUrlInput.value,
      username: formEl.usernameInput.value,
      password: formEl.passwordInput.value,
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

    this.elements.form.container.innerHTML = `<h2>${titleText}</h2>`;

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
    this.elements.form.container.appendChild(typeRow);
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
    this.elements.form.container.appendChild(nameRow);

    // Base url
    const baseUrlRow = document.createElement('div');
    baseUrlRow.classList.add('form-row', 'base-url');
    const baseUrlLabelContainer = document.createElement('div');
    baseUrlRow.appendChild(baseUrlLabelContainer);
    baseUrlLabelContainer.appendChild(formEl.baseUrlLabel);
    formEl.baseUrlInfoIconContainer.innerHTML = SvgInformationOutline;
    baseUrlLabelContainer.appendChild(formEl.baseUrlInfoIconContainer);
    formEl.baseUrlInput.type = 'text';
    formEl.baseUrlInput.required = true;
    if (this.options.dataSource?.baseUrl) {
      formEl.baseUrlInput.value = this.options.dataSource.baseUrl;
    }
    baseUrlRow.appendChild(formEl.baseUrlInput);
    this.elements.form.container.appendChild(baseUrlRow);
    this.onTypeSelectChange(); // initially update base url input according to selected ds type

    // Basic auth
    const basicAuthRow = document.createElement('div');
    basicAuthRow.classList.add('form-row');
    basicAuthRow.innerHTML = `<div>Basic Authentication:</div>`;
    formEl.basicAuthCheckbox.type = 'checkbox';
    if (isBasicAuthEnabled) {
      formEl.basicAuthCheckbox.checked = true;
    }
    basicAuthRow.appendChild(formEl.basicAuthCheckbox);
    this.elements.form.container.appendChild(basicAuthRow);
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
    this.elements.form.container.appendChild(formEl.usernameRow);
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
    this.elements.form.container.appendChild(formEl.passwordRow);
    if (!isBasicAuthEnabled) {
      formEl.passwordRow.style.display = 'none';
    }

    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('buttons');
    this.elements.form.container.appendChild(buttonsContainer);

    const leftButtons = document.createElement('div');
    leftButtons.classList.add('left');
    buttonsContainer.appendChild(leftButtons);

    const rightButtons = document.createElement('div');
    rightButtons.classList.add('right');
    buttonsContainer.appendChild(rightButtons);

    formEl.cancelButton.classList.add('cancel');
    formEl.cancelButton.type = 'button';
    formEl.cancelButton.textContent = 'Cancel';
    leftButtons.appendChild(formEl.cancelButton);

    formEl.testButton.classList.add('test');
    formEl.testButton.type = 'button';
    formEl.testButton.textContent = 'Test';
    rightButtons.appendChild(formEl.testButton);

    formEl.saveButton.classList.add('save', 'primary');
    formEl.saveButton.type = 'submit';
    formEl.saveButton.textContent = 'Save';
    formEl.saveButton.disabled = this.options.type == 'new';
    rightButtons.appendChild(formEl.saveButton);
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
      formEl.baseUrlInput.placeholder = 'http://0.0.0.0:16686/api';
      formEl.baseUrlLabel.textContent = `Query API Base URL:`;
      this.baseUrlInfoTooltipContent.textContent = `Base URL of jaeger-query service, most common form http://x.x.x.x:16686/api`;
    }

    if (formEl.typeSelect.value == DataSourceType.ZIPKIN) {
      formEl.baseUrlInput.placeholder = 'http://0.0.0.0:9411/api/v2';
      formEl.baseUrlLabel.textContent = `API Base URL:`;
      this.baseUrlInfoTooltipContent.textContent = `Base URL of Zipkin's v2 API, most common form http://x.x.x.x:9411/api/v2`;
    }
  }

  dispose() {
    this.elements.form.cancelButton.removeEventListener(
      'click',
      this.binded.onCancelButtonClick,
      false
    );
    this.elements.form.testButton.removeEventListener(
      'click',
      this.binded.onTestButtonClick,
      false
    );
    this.elements.form.container.removeEventListener(
      'submit',
      this.binded.onFormSubmit,
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
    this.baseUrlInfoTooltipTippy.destroy();
  }
}
