import * as _ from 'lodash';
import * as randomColor from 'randomcolor';
import chroma from 'chroma-js';
import { IColorAssigner } from '../interfaces';
console.log(randomColor);


interface RandomColorAssignerOptions {
  shuffle?: boolean;
  hue?: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'monochrome' | undefined;
  luminosity?: 'bright' | 'light' | 'dark' | undefined;
  count?: number;
}

/**
 * Uses `randomcolor` package
 * https://github.com/davidmerfield/randomColor
 */
export class RandomColorAssigner implements IColorAssigner {
  private index = 0;
  private colors: {
    hex: string,
    rgb: {
      r: number,
      g: number,
      b: number
    }
  }[] = [];
  private keyColorIndexMap: { [key: string]: number } = {};


  constructor(options?: RandomColorAssignerOptions) {
    options = _.defaults({}, options || {}, {
      shuffle: false,
      luminosity: 'light',
      count: 100
    });
    const rawColors = randomColor(options);

    this.colors = rawColors.map((rawColor: string) => {
      const color = chroma(rawColor);
      const [r, g, b] = color.rgb();
      return {
        hex: rawColor,
        rgb: { r, g, b }
      };
    });
  }


  colorFor(key: string, type: 'hex' | 'rgb' = 'hex') {
    let index = this.keyColorIndexMap[key];
    if (!_.isNumber(index)) {
      index = this.index;
      this.keyColorIndexMap[key] = index;
      this.index = (this.index + 1) % this.colors.length;
    }
    const color = this.colors[index];
    return color[type];
  }


  reset() {
    this.index = 0;
    this.keyColorIndexMap = {};
  }
}


export default RandomColorAssigner;
