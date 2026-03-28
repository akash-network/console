import { useMemo } from "react";

import type { SnapshotValue } from "@/types";

export function useCompletedSnapshots(snapshots: SnapshotValue[] | undefined) {
  return useMemo(() => {
    if (!snapshots || snapshots.length <= 1) {
      return undefined;
    }

    return snapshots.slice(0, -1);
  }, [snapshots]);
}
