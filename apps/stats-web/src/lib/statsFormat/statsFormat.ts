import { bytesToShrink } from "@/lib/unitUtils";

export const EMPTY_VALUE = "—";

export function formatNumber(value: number | undefined) {
  return value === undefined ? EMPTY_VALUE : Math.round(value).toLocaleString("en-US");
}

export function formatCompact(value: number | undefined) {
  if (value === undefined) return EMPTY_VALUE;

  const magnitude = Math.abs(value);

  if (magnitude >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (magnitude >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (magnitude >= 1e4) return `${(value / 1e3).toFixed(1)}K`;

  return formatNumber(value);
}

export function formatUsd(value: number | undefined, { compact = false } = {}) {
  if (value === undefined) return EMPTY_VALUE;

  return `$${compact ? formatCompact(value) : formatNumber(value)}`;
}

export function formatUsdPrice(value: number | undefined) {
  return value === undefined ? EMPTY_VALUE : `$${value.toFixed(2)}`;
}

export function formatBytes(value: number | undefined) {
  if (value === undefined) return EMPTY_VALUE;

  const { value: shrunk, unit } = bytesToShrink(value);

  return `${shrunk.toFixed(shrunk >= 100 ? 0 : shrunk >= 10 ? 1 : 2)} ${unit}`;
}

export function formatPercent(value: number | undefined, { signed = false } = {}) {
  if (value === undefined) return EMPTY_VALUE;

  return `${signed && value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatDelta(percent: number, period: string) {
  return `${percent >= 0 ? "↗ +" : "↘ "}${percent.toFixed(1)}% · ${period}`;
}

export function formatShortDate(time: number) {
  return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatLongDate(time: number) {
  return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function formatAgo(time: number, now = Date.now()) {
  const seconds = Math.max(1, Math.floor((now - time) / 1000));

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

export function formatHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}
