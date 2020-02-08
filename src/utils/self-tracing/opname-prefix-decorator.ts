const ObjectKey = Symbol('defaultOperationNamePrefix');

export function OperationNamePrefix(prefix: string) {
  return (target: Function) => {
    target.prototype[ObjectKey] = prefix;
  };
}

export function getOperationNamePrefix(obj: {}): string | undefined {
  return (obj as any)[ObjectKey];
}
