import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { TypeScriptManager } from './typescript-manager';
import { Stage } from '../../model/stage';
import { Span, SpanLog } from '../../model/interfaces';
import * as shortid from 'shortid';
import throttle from 'lodash/throttle';
import isBoolean from 'lodash/isBoolean';
import isFunction from 'lodash/isFunction';
import sampleSize from 'lodash/sampleSize';
import { ModalManager } from '../ui/modal/modal-manager';

import CheckCircleOutlineSvg from '!!raw-loader!@mdi/svg/svg/check-circle-outline.svg';
import AlertCircleOutlineSvg from '!!raw-loader!@mdi/svg/svg/alert-circle-outline.svg';
import CloseCircleOutlineSvg from '!!raw-loader!@mdi/svg/svg/close-circle-outline.svg';
import './form-modal-content.css';

export interface LogFilteringRawOptions {
  key: string;
  name: string;
  rawCode: string;
  compiledCode: string;
}

export interface LogFilteringOptions {
  key: string;
  name: string;
  filterBy: (log: SpanLog, span: Span) => boolean;
}

export interface LogFilteringFormModalContentOptions {
  // showNameField?: boolean; // TODO: Implement it when you need it!
  rawOptions?: LogFilteringRawOptions;
}

export class LogFilteringFormModalContent {
  private elements = {
    container: document.createElement('div'),
    monacoContainer: document.createElement('div'),
    testResultContainer: document.createElement('div'),
    cancelButton: document.createElement('button'),
    saveButton: document.createElement('button'),
    testButton: document.createElement('button'),
  };
  private model?: monaco.editor.ITextModel;
  private editor?: monaco.editor.IStandaloneCodeEditor;
  private editorContentChangeListener?: monaco.IDisposable;
  private tsManager = TypeScriptManager.getSingleton();
  private stage = Stage.getSingleton();

  private binded = {
    onCancelButtonClick: this.onCancelButtonClick.bind(this),
    onSaveButtonClick: this.onSaveButtonClick.bind(this),
    onTestButtonClick: this.onTestButtonClick.bind(this),
    onMonacoEditorContentChange: throttle(
      this.onMonacoEditorContentChange.bind(this),
      100
    ),
  };

  constructor(private options: LogFilteringFormModalContentOptions) {
    // Prepare DOM
    const els = this.elements;
    els.container.classList.add('customization-form-modal-content');

    els.monacoContainer.classList.add('monaco-container');
    els.container.appendChild(els.monacoContainer);

    els.testResultContainer.classList.add('test-result');
    els.testResultContainer.style.display = 'none';
    els.container.appendChild(els.testResultContainer);

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
    els.saveButton.disabled = true;
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

    // Must be called after the container is mounted and ready,
    // so that it can gather its dimensions correctly
    this.initMonacoEditor();
  }

  private initMonacoEditor() {
    const code = this.options.rawOptions
      ? this.options.rawOptions.rawCode
      : `// Do something with "log" and "span" and return a boolean\n` +
        `function filterBy(log: SpanLog, span: Span): boolean {\n` +
        `    return log.fields.hasOwnProperty('error');\n` +
        `}\n`;

    this.model = monaco.editor.createModel(code, 'typescript');
    this.editor = monaco.editor.create(this.elements.monacoContainer, {
      minimap: { enabled: false },
    });
    this.editor.setModel(this.model);

    // https://github.com/Microsoft/monaco-editor/issues/1017#issuecomment-414615634
    this.editor.addCommand(
      monaco.KeyCode.Escape,
      () => {
        if (document.activeElement) (document.activeElement as any).blur();
      },
      '!findWidgetVisible && !inReferenceSearchEditor && !editorHasSelection'
    );
    this.editor.focus();

    this.editorContentChangeListener = this.model.onDidChangeContent(
      this.binded.onMonacoEditorContentChange
    );
  }

  getElement() {
    return this.elements.container;
  }

  private onMonacoEditorContentChange() {
    this.elements.testResultContainer.style.display = 'none';
    this.elements.saveButton.disabled = true;
  }

  private onCancelButtonClick() {
    const modal = ModalManager.getSingleton().findModalFromElement(
      this.elements.container
    );
    if (!modal) throw new Error(`Could not find modal instance`);
    modal.close({ data: { action: 'cancel' } });
  }

  private async onSaveButtonClick() {
    try {
      const result = await this.onTestButtonClick();
      const modal = ModalManager.getSingleton().findModalFromElement(
        this.elements.container
      );
      if (!modal) throw new Error(`Could not find modal instance`);
      modal.close({ data: { action: 'save', ...result } });
    } catch (err) {}
  }

  private async onTestButtonClick() {
    this.elements.saveButton.disabled = true;
    this.elements.testResultContainer.style.display = 'none';

    try {
      const result = await this.test();

      this.elements.saveButton.disabled = false;
      if (result.testedLogs.length == 0) {
        this.showTestResult({
          type: 'warning',
          title: 'No spans in the stage to test',
          body:
            `Span filtering function seems OK, you can save it. However it's not tested on any real ` +
            `spans, since there is no trace added to the stage.`,
        });
      } else {
        this.showTestResult({
          type: 'success',
          title: 'Test successful',
          body: `Span filtering function seems OK. It's tested on ${
            result.testedLogs.length
          } span(s) in
            the stage and here are some samples: <br />
            <ul>
              ${sampleSize(result.testedLogs, 5)
                .map(
                  (test) =>
                    `<li>
                  ${test.logSpan[1].operationName} => <pre>${test.rv}</pre>
                </li>`
                )
                .join('')}
            </ul>`,
        });
      }

      return result;
    } catch (err) {
      this.showTestResult({
        type: 'error',
        title: err.message,
        body: err.description || '',
      });
    }
  }

  private showTestResult(options: {
    type: 'success' | 'warning' | 'error';
    title: string;
    body?: string;
  }) {
    const el = this.elements.testResultContainer;
    el.classList.remove('success', 'warning', 'error');
    el.classList.add(options.type);
    const svg = {
      success: CheckCircleOutlineSvg,
      warning: AlertCircleOutlineSvg,
      error: CloseCircleOutlineSvg,
    }[options.type];
    el.innerHTML = `${svg}
      <div class="title">${options.title}</div>
      <div class="body">${options.body || ''}</div>`;
    el.style.display = 'block';
  }

  private async test() {
    if (!this.model) throw new Error('Monaco text model is not ready');
    if (!this.editor) throw new Error('Monaco editor is not ready');
    const tsCode = this.editor.getValue();
    const compiledJSCode = await this.tsManager.compile(this.model.uri);

    let filterByFn: Function | undefined = undefined;
    try {
      filterByFn = TypeScriptManager.generateFunction(
        compiledJSCode,
        'filterBy'
      );
    } catch (err) {
      if (err.message == `filterBy is not defined`) {
        const customErr = new Error(`Unexpected "filterBy" function`);
        (customErr as any).description = `You have to declare a function named "filterBy" and it has to return a boolean.`;
        throw customErr;
      }

      throw err;
    }

    if (!isFunction(filterByFn)) {
      const err = new Error(`Unexpected "filterBy" function`);
      (err as any).description = `You have to declare a function named "filterBy" and it has to return a boolean.`;
      throw err;
    }

    const logsSpansToTest = this.stage.getAllLogs();
    const testedLogs: { logSpan: [SpanLog, Span]; rv: boolean }[] = [];
    for (let [log, span] of logsSpansToTest) {
      const rv = filterByFn(log, span);
      if (!isBoolean(rv)) {
        console.error(
          `Return value of "filterBy" function must be a boolean, but recieved "${typeof rv}" for log and span`,
          log,
          span
        );
        const err = new Error(`Function returned not a boolean`);
        (err as any).description =
          `Return value of "filterBy" function has to be a string, but got "${typeof rv}" ` +
          `for log & span. Please check your console for further details. Press Command+Option+I or Ctrl+Option+I to ` +
          `open devtools.`;
        throw err;
      }
      testedLogs.push({ logSpan: [log, span], rv });
    }

    return { tsCode, compiledJSCode, filterBy: filterByFn, testedLogs };
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

    this.editor?.dispose();
    this.model?.dispose();
    this.editorContentChangeListener?.dispose();
    this.editor = undefined;
    this.model = undefined;
    this.editorContentChangeListener = undefined;
  }
}
