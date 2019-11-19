import chroma from 'chroma-js';

const WHITE = chroma('white');
const BLACK = chroma('black');

export function textColorFor(hex: string) {
  const color = chroma(hex);
  const contrastWithWhite = chroma.contrast(color, WHITE);
  const contrastWithBlack = chroma.contrast(color, BLACK);
  const textColor = contrastWithWhite >= contrastWithBlack ? '#fff' : '#000';

  return textColor;
}
