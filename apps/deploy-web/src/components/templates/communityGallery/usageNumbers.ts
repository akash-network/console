const COMPACT_COUNT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function formatCount(count: number): string {
  return COMPACT_COUNT.format(count);
}

export function formatStillUp(share: number): string {
  return `${Math.round(share * 100)}% still up after 24 h`;
}

export function pluralize(count: number, singular: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : `${singular}s`}`;
}
