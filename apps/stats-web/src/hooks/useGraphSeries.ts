import { useMemo } from "react";

import { toSeries } from "@/lib/series/series";
import { useGraphSnapshot } from "@/queries";

export function useGraphSeries(snapshot: string, scale?: (value: number) => number) {
  const { data } = useGraphSnapshot(snapshot);

  return useMemo(() => {
    const series = data ? toSeries(data, scale) : [];

    return series.length ? series : undefined;
  }, [data, scale]);
}
