// Intentionally complies with `Span` interface
// finishTime >= startTime
export interface Interval {
  startTime: number;
  finishTime: number;
}

export function isOverlapped(a: Interval, b: Interval) {
  return !(b.startTime > a.finishTime || a.startTime > b.finishTime);
}

export function union(intervals: Interval[]) {
  // Sort according to startTime and finishTime
  const sorted = intervals.sort(
    (a, b) => a.startTime - b.startTime || a.finishTime - b.finishTime
  );
  const acc: Interval[] = [];
  sorted.forEach((interval) => {
    const lastInterval = acc[acc.length - 1];
    if (lastInterval && isOverlapped(lastInterval, interval)) {
      lastInterval.finishTime = interval.finishTime;
    } else {
      acc.push({
        startTime: interval.startTime,
        finishTime: interval.finishTime,
      });
    }
  });
  return acc;
}
