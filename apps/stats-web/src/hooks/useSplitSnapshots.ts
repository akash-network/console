import { useMemo } from "react";

import type { SnapshotValue } from "@/types";

interface SplitSnapshotsInput {
  snapshots: SnapshotValue[];
  currentValue: number;
}

interface SplitSnapshots {
  completed: SnapshotValue[] | undefined;
  inProgress: SnapshotValue | undefined;
}

export function useSplitSnapshots(snapshotData: SplitSnapshotsInput | undefined): SplitSnapshots {
  return useMemo(() => {
    if (!snapshotData?.snapshots || snapshotData.snapshots.length <= 1) {
      return { completed: undefined, inProgress: undefined };
    }
    return {
      completed: snapshotData.snapshots.slice(0, -1),
      inProgress: { date: new Date().toISOString(), value: snapshotData.currentValue }
    };
  }, [snapshotData]);
}
