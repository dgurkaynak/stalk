import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';


let _singletonIns: TypeScriptManager;

export default class TypeScriptManager {
  private worker: any;

  static getSingleton() {
    if (!_singletonIns) _singletonIns = new TypeScriptManager();
    return _singletonIns;
  }

  async init() {
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2015,
      module: monaco.languages.typescript.ModuleKind.None
    });

    this.worker = await monaco.languages.typescript.getTypeScriptWorker();
  }

  async compile(uri: monaco.Uri) {
    const client = await this.worker(uri)
    const result = await client.getEmitOutput(uri.toString());
    return result.outputFiles[0].text;
  }

  static generateFunction(code: string) {
    return new Function(code)();
  }
}
