import { useEffect, useMemo, useRef, useState } from "react";

import type { DeploymentFlow, DeploymentFlowPhase } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import { useQuoteExpiry } from "@src/components/deployments/ConfigureDeployment/useQuoteExpiry/useQuoteExpiry";
import { useServices } from "@src/context/ServicesProvider";
import type { DeployPhase, DeployPhaseId, DeployProgressState } from "@src/hooks/useAutoDeploymentFlow/deployPhases";
import { PHASE_ORDER, useDeployPhaseProgress } from "@src/hooks/useAutoDeploymentFlow/deployPhases";
import { BID_POLL_INTERVAL } from "@src/queries/useListBids";
import { useFirstReachableProvider, useProviderList } from "@src/queries/useProvidersQuery";
import type { ApiProviderList } from "@src/types/provider";
import { formatBidId, parseBidId } from "@src/utils/bids/bidId";
import { DeploymentGroups } from "@src/utils/deploymentData/helpers";

type Options = {
  sdl: string;
  /**
   * Live (non-closed) leases already on chain for a resumed deployment, resolved once by the `ResumeDeploymentGuard`
   * and passed in so the flow reconstructs a selection per already-leased group and lets the idempotent server
   * create-lease re-send the manifest. Empty on a fresh start or when the deployment has no live leases (which
   * re-quotes from scratch).
   */
  resumeLeases?: LeaseId[];
  /**
   * The shared base flow state machine, created once by the `DeploymentFlowProvider` (which seeds it from the resolved
   * intent — the resumed dseq included — and gates its create on trial readiness). This hook only autopilots over it and
   * projects its phase onto the progress UI; it no longer owns the flow, so the auto and manual branches share one
   * instance. When resuming a dseq, the provider seeds the flow in `quoting`, so the autopilot skips create.
   */
  flow: DeploymentFlow;
};

type Result = {
  state: DeployProgressState;
  progressPercent: number;
  phases: [DeployPhase, DeployPhase, DeployPhase];
  matchedProviderAddress: string | null;
  /**
   * The live deployment dseq once the flow has created (or resumed) one; undefined until then. Lets the auto screen
   * hand the in-progress deployment off to the manual configure form so "Choose my provider" resumes it rather than
   * abandoning it.
   */
  dseq?: string;
  /** Discards the failed attempt — closing the on-chain deployment when one exists — and restarts from creating a fresh one. */
  tryAgain: () => void;
  /**
   * Stops the autopilot from matching a provider and deploying (creating leases). Called when the user takes over via
   * "Choose my provider", so the deployment can be handed to the manual configure form (which shares the same flow)
   * without the autopilot leasing it out from under them. The deployment creation is deliberately left to finish, so
   * the hand-off always inherits a live, quoting deployment rather than a dangling one. Scoped to this auto session —
   * a fresh attempt (a remount, or `tryAgain`) re-enables it.
   */
  stopAutopilot: () => void;
};

/**
 * How long the autopilot may sit in `quoting` with bids on the table before abandoning the attempt. The quote window
 * runs ~5 minutes, but everything left at that point — probe the bidders, record a selection, fire the lease — is
 * seconds of work, so 90s without progress means it is not coming and holding the deposit longer buys nothing.
 */
const MATCH_DEADLINE_MS = 90 * 1000;

const MATCH_FAILED_MESSAGE = "We couldn't match this deployment with a provider in time. Try again, or contact support if it keeps happening.";

/** The four coordinates that identify a lease/bid. */
type LeaseId = { dseq: string; gseq: number; oseq: number; provider: string };

/**
 * The 1-based group sequences (gseqs) the deployment must fill — one per SDL placement. The chain numbers groups in the
 * order they're submitted in the create-deployment message, which is the order `DeploymentGroups` returns them, so the
 * gseq is the group's 1-based index. Falls back to a single group when the SDL can't be parsed so matching still runs.
 */
function getRequiredGseqs(sdl: string): number[] {
  try {
    const count = DeploymentGroups(sdl).length;
    return count > 0 ? Array.from({ length: count }, (_, index) => index + 1) : [1];
  } catch {
    return [1];
  }
}

export const DEPENDENCIES = {
  useServices,
  useProviderList,
  useFirstReachableProvider,
  useQuoteExpiry,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  getRequiredGseqs,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  matchDeadlineMs: MATCH_DEADLINE_MS
};

/**
 * Autopilot + progress projection over the shared base {@link DeploymentFlow}. There is exactly one real state
 * machine — the manual configure flow, created once by the `DeploymentFlowProvider` and passed in as `flow` — and this
 * hook drives it automatically for the auto-deploy (animated globe) experience:
 * it fires `requestQuotes` once the trial wallet is ready, then — for each of the deployment's placements (groups) —
 * watches live bids for that group's first *reachable* provider and records it as the flow's selection, firing `deploy`
 * only once every placement has a provider. The underlying flow owns URL resume, multi-lease, the pre-lease
 * `updateDeployment` reconcile, SDL caching, and the deploy-success redirect — the auto flow inherits all of it for free.
 *
 * On top of the flow it keeps the auto-only concerns: per-group reachability selection (`listBids` + `useProviderList` +
 * `useFirstReachableProvider`), trial gating, reconstructing a selection from each already-leased group (the
 * `ResumeDeploymentGuard` resolves the deployment's leases upfront and passes them in via `resumeLeases`, so the
 * idempotent server create-lease re-sends the manifest), the phased progress-bar animation, and the matched-provider
 * address. `flow.phase` is projected onto the three-step create → match → prepare progress UI.
 */
export function useAutoDeploymentFlow({ sdl, resumeLeases = [], flow }: Options, dependencies: typeof DEPENDENCIES = DEPENDENCIES): Result {
  const { analyticsService, logger } = dependencies.useServices();
  const sdlRef = useRef(sdl);
  sdlRef.current = sdl;

  const [retryToken, setRetryToken] = useState(0);

  // Latched on when the user takes manual control ("Choose my provider"): the autopilot stops matching a provider and
  // deploying (creating leases), but still lets the deployment creation finish — so the manual form inherits a live,
  // quoting deployment to drive rather than being handed a dangling one.
  const [autopilotStopped, setAutopilotStopped] = useState(false);

  const dseq = flow.dseq;

  // The live (non-closed) leases keyed by group sequence, resolved upfront by the `ResumeDeploymentGuard` so a resumed
  // multi-placement deployment restores the provider chosen for each already-leased group. Empty on a fresh start, or
  // when the deployment had no live leases (the guard redirects an already-finished deployment away, so a rendered auto
  // flow either has every group leased — reconstruct the selection and re-send the manifest — or none — match from bids).
  const leasesByGseq = useMemo(() => {
    const byGseq = new Map<number, LeaseId>();
    for (const lease of resumeLeases) {
      byGseq.set(lease.gseq, lease);
    }
    return byGseq;
  }, [resumeLeases]);

  // Every group (gseq) the deployment must fill — one per SDL placement, unioned with any already-leased group so a
  // resume restores every on-chain lease even when the SDL can't be parsed. A bid/lease's gseq identifies its group.
  const requiredGseqs = useMemo(() => {
    const gseqs = new Set(dependencies.getRequiredGseqs(sdl));
    for (const gseq of leasesByGseq.keys()) gseqs.add(gseq);
    return Array.from(gseqs).sort((a, b) => a - b);
  }, [sdl, leasesByGseq, dependencies]);

  // Groups already recorded as flow selections (a bid id embeds its gseq). Reactive, so matching advances group by group.
  const selectedGseqs = useMemo(() => new Set(Object.values(flow.selections).map(bidId => parseBidId(bidId).gseq)), [flow.selections]);

  // The one group we're actively matching a provider for: the first required group that has neither an existing lease nor
  // a recorded selection. Groups resolve one at a time so each gets its own first reachable provider.
  const matchingGseq = requiredGseqs.find(gseq => !leasesByGseq.has(gseq) && !selectedGseqs.has(gseq));

  // Bids come straight off the flow's own query, scoped to the group currently being matched: the flow is the single
  // owner of the bids subscription, the autopilot only reads them to match a provider for that group.
  const openBids =
    flow.phase === "quoting" && matchingGseq !== undefined ? flow.bids.filter(bid => bid.bid.state === "open" && bid.bid.id.gseq === matchingGseq) : [];

  const { data: providers } = dependencies.useProviderList({ enabled: flow.phase === "quoting" });
  const candidateProviders = openBids
    .map(bid => providers?.find(provider => provider.owner === bid.bid.id.provider))
    .filter((provider): provider is ApiProviderList => !!provider);

  // Names the group being matched, so the probe is cached per placement instead of per candidate list: bids keep
  // arriving while a probe runs, and a candidate-derived key would discard it and restart from the first candidate.
  const placementKey = dseq && matchingGseq !== undefined ? `${dseq}/${matchingGseq}` : null;
  const reachableProviderQuery = dependencies.useFirstReachableProvider(placementKey, candidateProviders, {
    enabled: flow.phase === "quoting" && candidateProviders.length > 0,
    refetchInterval: BID_POLL_INTERVAL
  });
  const reachableProvider = reachableProviderQuery.data;
  const activeBid = reachableProvider ? openBids.find(bid => bid.bid.id.provider === reachableProvider.owner) : undefined;

  // Every selection ready to record now: one per already-leased group the flow has not recorded yet (a resume takes
  // those verbatim), plus the first reachable open bid for the group currently being matched. Both are keyed off what
  // the flow actually holds, so a selection it dropped — its bid died, or a resumed one was pruned — is matched again
  // on the next render, while one that still stands is never re-recorded.
  const selectionTargets = useMemo<LeaseId[]>(() => {
    const targets: LeaseId[] = [];
    for (const gseq of requiredGseqs) {
      const lease = leasesByGseq.get(gseq);
      if (lease && !selectedGseqs.has(gseq)) targets.push(lease);
    }
    if (activeBid) {
      targets.push({ dseq: activeBid.bid.id.dseq, gseq: activeBid.bid.id.gseq, oseq: activeBid.bid.id.oseq, provider: activeBid.bid.id.provider });
    }
    return targets;
  }, [requiredGseqs, leasesByGseq, selectedGseqs, activeBid]);

  useEffect(
    function fireCreate() {
      // requestQuotes moves the flow off "configuring" synchronously, so the phase guard alone prevents a re-fire.
      // The flow lives in the parent provider now, so on mount this child effect runs before the flow's own effects;
      // that's inert here — those effects early-return unless phase === "quoting", and the mount phase is "configuring".
      if (flow.phase !== "configuring") return;
      flow.actions.requestQuotes(sdlRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.phase, retryToken]
  );

  useEffect(
    function recordSelections() {
      // A failed deploy is terminal for the auto flow — the error scene is up and "Try again" starts a fresh attempt.
      // Re-recording a selection here would clear the flow's deploy error, which is exactly what `fireDeploy` reads as
      // terminal, and so re-fire the lease on every bid poll.
      if (autopilotStopped || flow.phase !== "quoting" || flow.deployError) return;
      for (const target of selectionTargets) {
        const bidId = formatBidId(target);
        flow.actions.selectProvider(bidId, bidId);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.phase, flow.deployError, selectionTargets, autopilotStopped]
  );

  // A multi-placement deployment leases all its groups together, so deploy waits until every required group has a
  // provider — not just the first.
  const allGroupsSelected = requiredGseqs.length > 0 && requiredGseqs.every(gseq => selectedGseqs.has(gseq));

  // The matched provider is a pure projection of the flow's own selections (bids/providers drop out of the queries once
  // the leases exist, so we read it back from the selections the autopilot recorded rather than tracking it separately).
  const matchedProviderAddress = useMemo(() => {
    const selectedBidId = Object.values(flow.selections)[0];
    return selectedBidId ? parseBidId(selectedBidId).provider : null;
  }, [flow.selections]);

  useEffect(
    function fireDeploy() {
      // deploy moves the flow off "quoting" synchronously; a failure drops it back with a `deployError`, which this guard
      // treats as terminal (the auto flow has no manual "pick another provider" step). Together they fire deploy exactly
      // once per attempt, so no separate one-shot ref is needed.
      if (autopilotStopped || flow.phase !== "quoting" || !allGroupsSelected || flow.deployError) return;
      flow.actions.deploy(sdlRef.current);
    },
    [flow.phase, allGroupsSelected, flow.deployError, autopilotStopped]
  );

  // Read through a ref so the deadline can call the latest action without re-arming on every render: the action's
  // identity changes with the close mutation's, which would reset the timer forever.
  const closeAndFailRef = useRef(flow.actions.closeAndFail);
  closeAndFailRef.current = flow.actions.closeAndFail;

  // The bid window's hard stop, off the same `listBids` entry the flow already polls. Best-effort — it stays null when
  // the chain endpoint is unavailable — so it only ever shortens the deadline below, never replaces it.
  const quoteExpiry = dependencies.useQuoteExpiry({ dseq: dseq ?? null, enabled: flow.phase === "quoting" });
  const quotesExpired = !!quoteExpiry?.isExpired;

  // True while the autopilot still owes this deployment a lease. A deployment that already holds one is excluded:
  // closing it would tear down a running workload, so a resume keeps waiting instead. A deploy error is excluded too —
  // the scene already shows it, and abandoning would overwrite it with a vaguer message.
  const isAutopilotPending = !autopilotStopped && flow.phase === "quoting" && !flow.deployError && leasesByGseq.size === 0;

  // Bids on the table mean the flow's own no-bids timeout has stood down for good (it latches off the first bid), so
  // from here the deadline is the autopilot's to keep.
  const hasBids = flow.bids.length > 0;

  // Read inside the deadline callback only, so their churn never re-arms it.
  const bidCountRef = useRef(0);
  bidCountRef.current = flow.bids.length;
  const candidateOwnersRef = useRef<string[]>([]);
  candidateOwnersRef.current = candidateProviders.map(provider => provider.owner);

  useEffect(
    function failWhenNoProviderIsMatched() {
      if (!isAutopilotPending || !hasBids) return;
      function giveUpOnMatching() {
        const reason = quotesExpired ? "quote_expired" : "deadline";
        // Logged here rather than per probe pass: a healthy match still takes several failing passes, and warning on
        // each would bury a session's Sentry breadcrumbs long before anything actually went wrong.
        logger.warn({ event: "AUTO_DEPLOY_MATCH_FAILED", reason, dseq, candidates: candidateOwnersRef.current });
        // The funnel goes dark between `bids_received` and `bid_selected`; this is the event that explains the gap.
        analyticsService.track("onboarding_match_failed", {
          category: "onboarding",
          reason,
          dseq,
          numberOfBids: bidCountRef.current,
          numberOfCandidates: candidateOwnersRef.current.length
        });
        closeAndFailRef.current(MATCH_FAILED_MESSAGE);
      }
      if (quotesExpired) {
        giveUpOnMatching();
        return;
      }
      const timer = setTimeout(giveUpOnMatching, dependencies.matchDeadlineMs);
      return function cancelMatchDeadline() {
        clearTimeout(timer);
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAutopilotPending, hasBids, quotesExpired]
  );

  const projected = projectPhase(flow.phase, flow.deploySucceeded, !!flow.deployError);
  const errorMessage = flow.deployError?.message ?? flow.error?.message;

  const phaseIndex = getPhaseIndex(projected);
  const { progressPercent, phases } = useDeployPhaseProgress(phaseIndex, { succeeded: projected === "success", resetKey: retryToken });

  function tryAgain() {
    // Restart the progress animation, then discard the failed attempt entirely: `cancelAndEdit` closes the deployment
    // on chain when one exists (a failed lease leaves the flow in `quoting` with a live dseq) and returns the flow to
    // `configuring`; a create that never produced a dseq goes straight back to `configuring`. Either way the autopilot's
    // `fireCreate` then broadcasts a brand-new deployment, so "Try again" always starts from scratch rather than
    // re-leasing the same one.
    setRetryToken(previous => previous + 1);
    setAutopilotStopped(false);
    flow.actions.cancelAndEdit();
  }

  // Hand-off for "Choose my provider": stop the autopilot so the manual form can drive the shared flow instead.
  function stopAutopilot() {
    setAutopilotStopped(true);
  }

  return {
    state: projected === "error" ? { kind: "error", message: errorMessage } : { kind: projected },
    progressPercent,
    phases,
    matchedProviderAddress,
    dseq: dseq ?? undefined,
    tryAgain,
    stopAutopilot
  };
}

type ProjectedPhase = DeployPhaseId | "success" | "error";

/** Projects the manual flow's phase onto the three-step auto progress UI (create → match → prepare) plus success/error. */
function projectPhase(phase: DeploymentFlowPhase, deploySucceeded: boolean, deployErrored: boolean): ProjectedPhase {
  if (deployErrored || phase === "error") return "error";
  if (deploySucceeded) return "success";
  switch (phase) {
    // `closing` in the auto flow only ever happens as the first step of "Try again" — tearing down the old deployment
    // before a fresh create — so it restarts progress at "creating" rather than jumping back to matching.
    case "configuring":
    case "creating":
    case "closing":
      return "creating";
    case "quoting":
      return "matching";
    case "deploying":
      return "preparing";
    default:
      return "creating";
  }
}

/** Map the projected phase to an index into `PHASE_ORDER`: success advances past the last marker, error falls back to phase 0. */
function getPhaseIndex(phase: ProjectedPhase): number {
  if (phase === "success") return PHASE_ORDER.length;
  if (phase === "error") return 0;
  return PHASE_ORDER.indexOf(phase);
}
