/**
 * Gets a global object on both browser and node.
 * Snippet is borrowed from browserify
 */
export default function getGlobal(): any {
  return typeof global !== 'undefined'
    ? global
    : typeof self !== 'undefined'
    ? self
    : typeof window !== 'undefined'
    ? window
    : {};
}
