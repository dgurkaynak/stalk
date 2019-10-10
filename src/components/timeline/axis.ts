
export default class Axis {
  private scale: number;
  private offset: number;

  constructor(
    private inputRange: [number, number],
    private outputRange: [number, number]
  ) {
    this.scale = (outputRange[1] - outputRange[0]) / (inputRange[1] - inputRange[0]);
    this.offset = outputRange[0] - (this.scale * inputRange[0]);
  }

  input2output(x: number) {
    return x * this.scale + this.offset;
  }

  output2input(y: number) {
    return (y - this.offset) / this.scale;
  }

  zoom(factor: number, anchorOutputPoint: number) {
    this.scale *= factor;
    this.offset = anchorOutputPoint * (1 - factor) + (this.offset * factor);
  }

  translate(delta: number) {
    this.offset += delta;
  }
}
