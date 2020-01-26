import defaults from 'lodash/defaults';
import isNumber from 'lodash/isNumber';
import * as randomColor from 'randomcolor';
import { IColorAssigner } from './interfaces';

interface RandomColorAssignerOptions {
  hue?:
    | 'red'
    | 'orange'
    | 'yellow'
    | 'green'
    | 'blue'
    | 'purple'
    | 'pink'
    | 'monochrome'
    | undefined;
  luminosity?: 'bright' | 'light' | 'dark' | undefined;
  count?: number;
}

/**
 * Uses `randomcolor` package
 * https://github.com/davidmerfield/randomColor
 */
export class RandomColorAssigner implements IColorAssigner {
  private index = 0;
  private colors: string[] = [];
  private keyColorIndexMap: { [key: string]: number } = {};

  constructor(options?: RandomColorAssignerOptions) {
    options = defaults({}, options || {}, {
      count: 50
    });
    this.colors = randomColor(options);
  }

  colorFor(key: string) {
    let index = this.keyColorIndexMap[key];
    if (!isNumber(index)) {
      index = this.index;
      this.keyColorIndexMap[key] = index;
      this.index = (this.index + 1) % this.colors.length;
    }
    return this.colors[index];
  }

  reset() {
    this.index = 0;
    this.keyColorIndexMap = {};
  }
}

export default RandomColorAssigner;
