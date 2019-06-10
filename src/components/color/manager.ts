import * as _ from 'lodash';
import palette from 'google-palette';
import chroma from 'chroma-js';



export class ColorManager {
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


  constructor(options?: {
    shuffle: boolean
  }) {
    const rawColors = options && _.isBoolean(options.shuffle) && options.shuffle ?
      _.shuffle(palette('mpn65', 65)) :
      palette('mpn65', 65);

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


export default ColorManager;
