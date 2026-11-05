import { useCallback } from "react";
import { useAtom } from "jotai";

import type { RecordedDeploymentOutcome } from "@src/store/deploymentOutcomeStore";
import { deploymentOutcomesAtom } from "@src/store/deploymentOutcomeStore";

type OutcomeToRecord = Omit<RecordedDeploymentOutcome, "isPrompted">;

export function useDeploymentOutcomes() {
  const [outcomes, setOutcomes] = useAtom(deploymentOutcomesAtom);

  const recordOutcome = useCallback(
    (dseq: string, recorded: OutcomeToRecord) =>
      setOutcomes(all => {
        const current = all[dseq];
        if (current?.isPrompted || (current?.outcome === recorded.outcome && current.failureReason === recorded.failureReason)) return all;

        return { ...all, [dseq]: { outcome: recorded.outcome, failureReason: recorded.failureReason } };
      }),
    [setOutcomes]
  );

  const markPrompted = useCallback(
    (dseq: string) =>
      setOutcomes(all => ({ ...all, [dseq]: { outcome: all[dseq]?.outcome ?? "unknown", failureReason: all[dseq]?.failureReason, isPrompted: true } })),
    [setOutcomes]
  );

  return { outcomes, recordOutcome, markPrompted };
}
