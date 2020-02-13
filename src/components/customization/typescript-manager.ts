import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import * as languageFeatures from 'monaco-editor/esm/vs/language/typescript/languageFeatures';
import DefaultInterfacesRawText from '!!raw-loader!../../model/interfaces.ts';
import * as opentracing from 'opentracing';
import { OperationNamePrefix } from '../../utils/self-tracing/opname-prefix-decorator';
import { Stalk, NewTrace, ChildOf, FollowsFrom } from '../../utils/self-tracing/trace-decorator';

let _singletonIns: TypeScriptManager;

@OperationNamePrefix('tsmanager.')
export class TypeScriptManager {
  private defaultInterfacesDisposable?: monaco.IDisposable;

  static getSingleton() {
    if (!_singletonIns) _singletonIns = new TypeScriptManager();
    return _singletonIns;
  }

  @Stalk({ handler: ChildOf })
  async init(ctx: opentracing.Span) {
    // TypeScriptManager.patchMonacoTypescriptToIgnoreDiagnostics();

    // monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    //   diagnosticCodesToIgnore: [/*top-level return*/ 1108]
    // } as any);

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      allowNonTsExtensions: true, // this is required somehow
      target: monaco.languages.typescript.ScriptTarget.ES2015,
      module: monaco.languages.typescript.ModuleKind.None
    });

    this.defaultInterfacesDisposable = monaco.languages.typescript.typescriptDefaults.addExtraLib(
      DefaultInterfacesRawText.replace(/export/g, '')
    );
  }

  @Stalk({ handler: NewTrace })
  async compile(ctx: opentracing.Span, uri: monaco.Uri) {
    const worker = await monaco.languages.typescript.getTypeScriptWorker();
    const client = await worker(uri);
    const input = uri.toString();
    const result = await client.getEmitOutput(input);
    const output = result.outputFiles[0].text;
    ctx.addTags({ input, output });
    return output;
  }

  static generateFunction(code: string, functionName: string) {
    return new Function(`${code}; return ${functionName};`)();
  }

  /**
   * Patch version of:
   * https://github.com/microsoft/monaco-typescript/pull/46
   */
  static patchMonacoTypescriptToIgnoreDiagnostics() {
    // Original code taken from:
    // https://github.com/microsoft/monaco-typescript/blob/3596f46e41922104181cda3ed981f5a25246882e/src/languageFeatures.ts#L159-L190
    languageFeatures.DiagnostcsAdapter.prototype._doValidate = function(
      resource: monaco.Uri
    ): void {
      this._worker(resource)
        .then((worker: any) => {
          if (!monaco.editor.getModel(resource)) {
            // model was disposed in the meantime
            return null;
          }
          const promises: Promise<any[]>[] = [];
          const {
            noSyntaxValidation,
            noSemanticValidation
          } = this._defaults.getDiagnosticsOptions();
          if (!noSyntaxValidation) {
            promises.push(worker.getSyntacticDiagnostics(resource.toString()));
          }
          if (!noSemanticValidation) {
            promises.push(worker.getSemanticDiagnostics(resource.toString()));
          }
          return Promise.all(promises);
        })
        .then((diagnostics: any) => {
          if (!diagnostics || !monaco.editor.getModel(resource)) {
            // model was disposed in the meantime
            return;
          }
          const markers = diagnostics
            .reduce((p: any, c: any) => c.concat(p), [])
            // ====> PATCH STARTED
            .filter(
              (d: any) =>
                (
                  this._defaults.getDiagnosticsOptions()
                    .diagnosticCodesToIgnore || []
                ).indexOf(d.code) === -1
            )
            // ====> PATCH ENDED
            .map((d: any) => this._convertDiagnostics(resource, d));

          monaco.editor.setModelMarkers(
            monaco.editor.getModel(resource) as any,
            this._selector,
            markers
          );
        })
        .then(undefined, (err: any) => {
          console.error(err);
        });
    };
  }
}
