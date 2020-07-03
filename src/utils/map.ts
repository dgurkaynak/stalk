// Derived from p5.js's map function
// https://github.com/processing/p5.js/blob/1.0.0/src/math/calculation.js#L459

export default function(
  n: number,
  start1: number,
  stop1: number,
  start2: number,
  stop2: number
) {
  const newval = ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
  if (start2 < stop2) {
    return constrain(newval, start2, stop2);
  } else {
    return constrain(newval, stop2, start2);
  }
}

function constrain(n: number, low: number, high: number) {
  return Math.max(Math.min(n, high), low);
}
