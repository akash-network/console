import { useEffect, useState } from "react";

import type { DeploymentFlowPhase } from "../../useDeploymentFlow/useDeploymentFlow";

const TICK_MS = 100;

export function useBidCollectingClock(phase: DeploymentFlowPhase, isRunning: boolean) {
  const [startedAt] = useState(() => Date.now());
  const [quotingStartedAt, setQuotingStartedAt] = useState(() => (phase === "quoting" ? startedAt : null));
  const [now, setNow] = useState(startedAt);

  if (phase === "quoting" && quotingStartedAt === null) setQuotingStartedAt(Date.now());

  useEffect(
    function tickWhileRunning() {
      if (!isRunning) return;
      const timer = setInterval(() => setNow(Date.now()), TICK_MS);
      return function stopTicking() {
        clearInterval(timer);
      };
    },
    [isRunning]
  );

  return {
    msSinceStart: now - startedAt,
    msSinceQuoting: quotingStartedAt === null ? null : Math.max(0, now - quotingStartedAt)
  };
}
