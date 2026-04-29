import { useMemo } from "react";

import type { SnapshotValue } from "@/types";

export function useInProgressSnapshot(snapshotData: { currentValue: number } | undefined): SnapshotValue | undefined {
  return useMemo(() => (snapshotData ? { date: new Date().toISOString(), value: snapshotData.currentValue } : undefined), [snapshotData]);
}
