import * as _ from 'lodash';
import palette from 'google-palette';
import { IColorAssigner } from './interfaces';


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
  private colors: string[] = [];
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

    this.colors = rawColors.map((c: string) => `#${c}`);
  }


  colorFor(key: string) {
    let index = this.keyColorIndexMap[key];
    if (!_.isNumber(index)) {
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


export default MPN65ColorAssigner;
