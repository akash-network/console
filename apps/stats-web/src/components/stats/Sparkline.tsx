import type { SeriesPoint } from "@/lib/series/series";
import { fitSeries } from "@/lib/series/series";

const SPARKLINE_PADDING = { top: 3, right: 3, bottom: 3, left: 1 };

export function Sparkline({ series, width = 120, height = 34 }: { series: SeriesPoint[] | undefined; width?: number; height?: number }) {
  if (!series || series.length < 2) {
    return <span className="block flex-none" style={{ width, height }} aria-hidden />;
  }

  const fitted = fitSeries(series, width, height, SPARKLINE_PADDING);
  const last = series[series.length - 1];

  return (
    <svg width={width} height={height} className="block flex-none" aria-hidden>
      <path d={fitted.line} fill="none" className="stroke-muted-foreground" strokeWidth={1.25} />
      <circle cx={fitted.xOf(series.length - 1)} cy={fitted.yOf(last.value)} r={2} className="fill-foreground" />
    </svg>
  );
}
