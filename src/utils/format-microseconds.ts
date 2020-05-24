import defaults from 'lodash/defaults';

export interface FormatMicrosecondsScale {
  unit: string;
  scale: number;
}

export interface FormatMicrosecondsOptions {
  scales?: FormatMicrosecondsScale[];
  minimumInteger?: number; // TODO: Our default min integer is 1, if integer part is below 1, scale down
  maximumFractionDigits?: number;
}

export function formatMicroseconds(
  microseconds: number,
  options?: FormatMicrosecondsOptions
) {
  options = defaults(options || {}, {
    scales: [
      // must be ordered
      { unit: 'µs', scale: 1 },
      { unit: 'ms', scale: 1000 },
      { unit: 's', scale: 1000000 }
    ],
    maximumFractionDigits: 3
  });

  let bestScale = options.scales[0];

  for (const scale of options.scales) {
    if (Math.floor(microseconds / scale.scale) == 0) break;
    bestScale = scale;
  }

  const num = microseconds / bestScale.scale;
  if (num === 0) return `0`;
  return `${Number(num.toFixed(options.maximumFractionDigits))} ${
    bestScale.unit
  }`;
}
