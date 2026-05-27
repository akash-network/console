import { useCallback, useEffect, useRef, useState } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";

import { useServices } from "@src/context/ServicesProvider";
import { usePhasedProgressBar } from "@src/hooks/useGradualProgress/usePhasedProgressBar";
import { useFirstReachableProvider, useProviderList } from "@src/queries/useProvidersQuery";
import type { ApiProviderList } from "@src/types/provider";

type DeploymentPhaseId = "creating" | "matching" | "preparing";
type DeploymentPhaseStatus = "pending" | "active" | "completed";

type Options = {
  sdl: string;
  deposit: number;
  onSuccess: (dseq: string) => void;
  /**
   * Whether the trial wallet is initialized server-side and ready to broadcast deployments.
   * While `false`, the flow stays in `creating` and silently waits — the user keeps seeing
   * "Creating deployment" while the trial spins up behind the scenes. Required so callers
   * can't accidentally stall the flow by omitting the readiness signal.
   */
  isWalletReady: boolean;
  /** If the trial-start mutation has terminally errored, the deploy step fails with this error instead of waiting forever. */
  trialError?: unknown;
};

type DeploymentPhase = {
  id: DeploymentPhaseId;
  label: string;
  status: DeploymentPhaseStatus;
};

type State = { kind: "creating" | "matching" | "preparing" | "success" } | { kind: "error"; message?: string };

type Result = {
  state: State;
  progressPercent: number;
  phases: [DeploymentPhase, DeploymentPhase, DeploymentPhase];
  matchedProviderAddress: string | null;
  retry: () => void;
  startOver: () => void;
};

type InternalPhase = DeploymentPhaseId | "success" | "error";

/** Poll cadence for `listBids` while we wait for the first active bid. The chain's bid-screening usually settles in <10s. */
const BID_POLL_INTERVAL = 2000;

/** Maximum bid-wait window. After this we fail the flow with an error overlay. */
const BID_TIMEOUT_MS = 300_000;

const PHASE_ORDER: ReadonlyArray<DeploymentPhaseId> = ["creating", "matching", "preparing"];

/**
 * Where each phase *ends* on the bar (0–100). These mirror the checkpoint marker positions
 * in DeployPhasesCard (`(i + 1) / phases.length * 100`), so the fill lands exactly on a
 * marker when its phase completes. Phase `i` eases from `PHASE_MARKERS[i - 1]` toward
 * `PHASE_MARKERS[i]` while it's being worked on.
 */
const PHASE_MARKERS: ReadonlyArray<number> = PHASE_ORDER.map((_, i) => ((i + 1) / PHASE_ORDER.length) * 100);

/**
 * Per-phase easing time constant in ms — roughly how long that phase typically takes, which
 * sets how fast the bar creeps toward the next marker. `creating` is a quick tx broadcast;
 * `matching` is the long bid-poll/provider-probe wait; `preparing` is a medium lease step.
 */
const PHASE_TIME_CONSTANTS: ReadonlyArray<number> = [3000, 12000, 6000];

const PHASE_LABELS: Record<DeploymentPhaseId, { active: string; completed: string }> = {
  creating: { active: "Creating deployment", completed: "Deployment created" },
  matching: { active: "Matching with providers", completed: "Providers matched" },
  preparing: { active: "Preparing deployment", completed: "Deployment prepared" }
};

export function usePhasedDeploymentFlow({ sdl, deposit, onSuccess, isWalletReady, trialError }: Options): Result {
  const { api } = useServices();
  const [phase, setPhase] = useState<InternalPhase>("creating");
  const [dseq, setDseq] = useState<string | null>(null);
  const [manifest, setManifest] = useState<string | null>(null);
  const [matchedProviderAddress, setMatchedProviderAddress] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const createDeployment = api.v1.createDeployment.useMutation();
  const createLease = api.v1.createLease.useMutation();

  useEffect(
    function broadcastCreateDeployment() {
      if (phase !== "creating") return;

      if (trialError) {
        setErrorMessage(extractApiErrorMessage(trialError) ?? undefined);
        setPhase("error");
        return;
      }

      if (!isWalletReady) return;

      let cancelled = false;

      function onCreateDeploymentSuccess(result: { data: { dseq: string; manifest: string } }) {
        if (cancelled) return;
        setDseq(result.data.dseq);
        setManifest(result.data.manifest);
        setPhase("matching");
      }

      function onCreateDeploymentError(error: unknown) {
        if (cancelled) return;
        setErrorMessage(extractApiErrorMessage(error) ?? undefined);
        setPhase("error");
      }

      createDeployment.mutate({ data: { sdl, deposit } }, { onSuccess: onCreateDeploymentSuccess, onError: onCreateDeploymentError });

      return function cancelCreateDeployment() {
        cancelled = true;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, retryToken, sdl, deposit, isWalletReady, trialError]
  );

  const bidsQuery = api.v1.listBids.useQuery(
    { dseq: dseq ?? "" },
    {
      enabled: phase === "matching" && !!dseq,
      refetchInterval: BID_POLL_INTERVAL
    }
  );

  const openBids = phase === "matching" ? bidsQuery.data?.data.filter(bid => bid.bid.state === "open") ?? [] : [];

  const { data: providers } = useProviderList({ enabled: phase === "matching" });
  const candidateProviders = openBids
    .map(bid => providers?.find(provider => provider.owner === bid.bid.id.provider))
    .filter((provider): provider is ApiProviderList => !!provider);

  const reachableProviderQuery = useFirstReachableProvider(candidateProviders, {
    enabled: phase === "matching" && candidateProviders.length > 0,
    refetchInterval: BID_POLL_INTERVAL
  });
  const reachableProvider = reachableProviderQuery.data;

  const activeBid = reachableProvider ? openBids.find(bid => bid.bid.id.provider === reachableProvider.owner) : undefined;

  useEffect(
    function broadcastCreateLease() {
      if (phase !== "matching" || !activeBid || !dseq || !manifest) return;

      setMatchedProviderAddress(activeBid.bid.id.provider);
      setPhase("preparing");

      function onCreateLeaseSuccess() {
        setPhase("success");
        onSuccessRef.current(dseq!);
      }

      function onCreateLeaseError(error: unknown) {
        setErrorMessage(extractApiErrorMessage(error) ?? undefined);
        setPhase("error");
      }

      createLease.mutate(
        {
          manifest,
          leases: [
            {
              dseq: activeBid.bid.id.dseq,
              gseq: activeBid.bid.id.gseq,
              oseq: activeBid.bid.id.oseq,
              provider: activeBid.bid.id.provider
            }
          ]
        },
        { onSuccess: onCreateLeaseSuccess, onError: onCreateLeaseError }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, activeBid, reachableProvider, dseq, manifest]
  );

  useEffect(
    function failOnBidTimeout() {
      if (phase !== "matching") return;
      const timeoutId = setTimeout(function onBidTimeout() {
        setPhase("error");
      }, BID_TIMEOUT_MS);
      return function cancelBidTimeout() {
        clearTimeout(timeoutId);
      };
    },
    [phase, dseq]
  );

  const retry = useCallback(function retry() {
    setDseq(null);
    setManifest(null);
    setMatchedProviderAddress(null);
    setErrorMessage(undefined);
    setPhase("creating");
    setRetryToken(prev => prev + 1);
  }, []);

  const phaseIndex = getPhaseIndex(phase);
  const phases = buildPhases(phaseIndex, phase === "success");

  const progressPercent = usePhasedProgressBar({
    markers: PHASE_MARKERS,
    activeIndex: phase === "success" ? PHASE_MARKERS.length : phaseIndex,
    timeConstants: PHASE_TIME_CONSTANTS,
    resetKey: retryToken
  });

  return {
    state: phase === "error" ? { kind: "error", message: errorMessage } : { kind: phase },
    progressPercent,
    phases,
    matchedProviderAddress,
    retry,
    startOver: retry
  };
}

/** Map the internal phase to an index into `PHASE_ORDER`: success advances past the last marker, error falls back to phase 0. */
function getPhaseIndex(phase: InternalPhase): number {
  if (phase === "success") return PHASE_ORDER.length;
  if (phase === "error") return 0;
  return PHASE_ORDER.indexOf(phase);
}

function buildPhases(activeIndex: number, allCompleted = false): [DeploymentPhase, DeploymentPhase, DeploymentPhase] {
  const phases = PHASE_ORDER.map((id, i): DeploymentPhase => {
    let status: DeploymentPhaseStatus;
    if (allCompleted || i < activeIndex) {
      status = "completed";
    } else if (i === activeIndex) {
      status = "active";
    } else {
      status = "pending";
    }
    return {
      id,
      label: status === "completed" ? PHASE_LABELS[id].completed : PHASE_LABELS[id].active,
      status
    };
  });
  return phases as [DeploymentPhase, DeploymentPhase, DeploymentPhase];
}
