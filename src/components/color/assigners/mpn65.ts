import * as _ from 'lodash';
import palette from 'google-palette';
import chroma from 'chroma-js';
import { IColorAssigner } from '../interfaces';


interface MPN65ColorAssignerOptions {
  shuffle?: boolean;
  excludeColors?: string[];
}

/**
 * mpn65 color palette
 * http://google.github.io/palette.js/
 */
export class MPN65ColorAssigner implements IColorAssigner {
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


  constructor(options?: MPN65ColorAssignerOptions) {
    options = _.defaults({}, options || {}, {
      shuffle: false,
      excludeColors: [
        'ff0029',
        '000000',
        '252525',
        '525252',
        '737373',
        '969696',
        'bdbdbd',
        'f43600',
        'e7298a',
        'e43872',
      ]
    });
    const rawColors: string[] = options.shuffle ?
      _.shuffle(palette('mpn65', 65)) :
      palette('mpn65', 65);

    if (options.excludeColors!.length > 0) {
      _.remove(rawColors, c => options!.excludeColors!.indexOf(c) > -1);
    }

    this.colors = rawColors.map((rawColor: string) => {
      const hex = `#${rawColor}`;
      const color = chroma(hex);
      const [r, g, b] = color.rgb();
      return {
        hex: hex,
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


export default MPN65ColorAssigner;
