
export default class Axis {
  private scale: number;
  private offset: number;
  private minScale: number;

  constructor(
    private inputRange: [number, number],
    private outputRange: [number, number]
  ) {
    this.reset(inputRange, outputRange);
  }

  getInputRange() {
    return this.inputRange.slice();
  }

  getOutputRange() {
    return this.outputRange.slice();
  }

  /**
   * Resets the both input and output domain range and re-inits
   * scale & offset & minScale to fit them all.
   *
   * TODO: Generalize this logic like updateOutputRange(), but it accepts
   * both input + output range and it will try to preserve current settings while
   * updating all.
   */
  reset(inputRange: [number, number], outputRange: [number, number]) {
    this.inputRange = inputRange;
    this.outputRange = outputRange;

    this.scale = (outputRange[1] - outputRange[0]) / (inputRange[1] - inputRange[0]);
    this.offset = outputRange[0] - (this.scale * inputRange[0]);
    this.minScale = this.scale;
  }

  /**
   * Updates output domain range. It's used when window is resized.
   * It tries to preserve current scale and offset, however they may change
   * like when window size is increasing, scale may increase due to fill
   * empty spaces.
   */
  updateOutputRange(outputRange: [number, number]) {
    this.outputRange = outputRange;
    this.minScale = (outputRange[1] - outputRange[0]) / (this.inputRange[1] - this.inputRange[0]);

    if (this.scale < this.minScale) {
      this.scale = this.minScale;
      this.offset = outputRange[0] - (this.scale * this.inputRange[0]);
    }

    this.preventTranslatingOutOfRange();
  }

  input2output(x: number) {
    return x * this.scale + this.offset;
  }

  output2input(y: number) {
    return (y - this.offset) / this.scale;
  }

  zoom(factor: number, anchorOutputPoint: number) {
    const newScale = Math.max(this.scale * factor, this.minScale);
    if (newScale === this.scale) return;
    this.scale = newScale;
    this.offset = anchorOutputPoint * (1 - factor) + (this.offset * factor);
    this.preventTranslatingOutOfRange();
  }

  translate(delta: number) {
    this.offset += delta;
    this.preventTranslatingOutOfRange();
  }

  preventTranslatingOutOfRange() {
    const minInput = this.inputRange[0];
    const minOutput = this.input2output(minInput);
    if (minOutput > this.outputRange[0]) {
      this.offset += this.outputRange[0] - minOutput;
    }

    const maxInput = this.inputRange[1];
    const maxOutput = this.input2output(maxInput);
    if (maxOutput < this.outputRange[1]) {
      this.offset += this.outputRange[1] - maxOutput;
    }
  }
}
