export interface IColorAssigner {
  colorFor(key: string, type: 'hex' | 'rgb'): string | { r: number, g: number, b: number };
}
