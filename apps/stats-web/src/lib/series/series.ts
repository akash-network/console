import type { GraphResponse } from "@/types/snapshots";

export type SeriesPoint = {
  time: number;
  value: number;
};

export type ChartPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type FittedSeries = {
  line: string;
  area: string;
  min: number;
  max: number;
  xOf: (index: number) => number;
  yOf: (value: number) => number;
};

export const RANGES = [
  { key: "7D", days: 7 },
  { key: "30D", days: 30 },
  { key: "90D", days: 90 },
  { key: "1Y", days: 365 },
  { key: "ALL", days: 0 }
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

/** The last snapshot is today's partial day, so it is replaced by the rolling current value the API reports alongside it. */
export function toSeries(graph: GraphResponse, scale: (value: number) => number = value => value, now = Date.now()): SeriesPoint[] {
  if (!graph.snapshots.length) {
    return [];
  }

  const completed = graph.snapshots.slice(0, -1).map(snapshot => ({ time: new Date(snapshot.date).getTime(), value: scale(snapshot.value) }));

  return [...completed, { time: now, value: scale(graph.currentValue) }];
}

export function daysOf(range: RangeKey) {
  return RANGES.find(({ key }) => key === range)?.days ?? 0;
}

export function sliceRange(series: SeriesPoint[], days: number) {
  return !days || days >= series.length ? series : series.slice(series.length - days);
}

export function deltaPercent(series: SeriesPoint[], days: number) {
  if (series.length < 2) {
    return 0;
  }

  const latest = series[series.length - 1].value;
  const reference = series[Math.max(0, series.length - 1 - (days || series.length))].value;

  return reference ? ((latest - reference) / reference) * 100 : 0;
}

export function fitSeries(series: SeriesPoint[], width: number, height: number, padding: ChartPadding): FittedSeries {
  const values = series.map(point => point.value);
  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    min -= 1;
    max += 1;
  }

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const lastIndex = Math.max(series.length - 1, 1);
  const xOf = (index: number) => padding.left + (index / lastIndex) * innerWidth;
  const yOf = (value: number) => padding.top + (1 - (value - min) / (max - min)) * innerHeight;
  const line = series.map((point, index) => `${index ? "L" : "M"}${xOf(index).toFixed(1)} ${yOf(point.value).toFixed(1)}`).join("");
  const area = series.length ? `${line}L${xOf(series.length - 1).toFixed(1)} ${height}L${xOf(0).toFixed(1)} ${height}Z` : "";

  return { line, area, min, max, xOf, yOf };
}

export function axisTicks(min: number, max: number, count: number) {
  const step = (max - min) / (count - 1);

  return Array.from({ length: count }, (_, index) => min + step * index);
}

export function labelIndexes(length: number, maxLabels: number) {
  const step = Math.max(1, Math.floor(length / maxLabels));
  const indexes: number[] = [];

  for (let index = 0; index < length - step / 2; index += step) {
    indexes.push(index);
  }

  return indexes;
}

export function nearestIndex(x: number, width: number, padding: ChartPadding, length: number) {
  const innerWidth = width - padding.left - padding.right;
  const index = Math.round(((x - padding.left) / innerWidth) * (length - 1));

  return Math.max(0, Math.min(length - 1, index));
}

export function summarize(series: SeriesPoint[]) {
  let low = series[0];
  let high = series[0];
  let sum = 0;

  for (const point of series) {
    if (point.value < low.value) low = point;
    if (point.value > high.value) high = point;
    sum += point.value;
  }

  return { low, high, average: sum / series.length };
}
