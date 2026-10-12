"use client";
import type { FC, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isApiError } from "@akashnetwork/openapi-sdk";
import { Snackbar, Spinner } from "@akashnetwork/ui/components";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import { PENDING_ACTIVITY_POLL_MS, useLatestActivitiesQuery } from "@src/queries/useLatestActivitiesQuery";
import { isStoredSdlRedeployable } from "@src/utils/sdl/storedDefinition";
import { UrlService } from "@src/utils/urlUtils";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import { buildConfigureUrl } from "../useDeploymentFlow/useDeploymentFlow";

/** The coordinates identifying a lease, in the same shape the auto flow reconstructs a selection from. */
export type ResumeLease = { dseq: string; gseq: number; oseq: number; provider: string };

export type RecordedDefinition = { sdl: string; name?: string };

export type ResumeResolution = {
  /**
   * Non-closed leases already on chain for a resumed deployment, so the auto flow can reconstruct a selection per
   * group and let the idempotent server create-lease re-send the manifest. Empty on a fresh start, a not-found
   * resume, or an open deployment with no live leases (which re-quotes from scratch).
   */
  activeLeases: ResumeLease[];
  /** The definition the console recorded for the version the chain runs, so a resume this browser holds no SDL for can still be leased. */
  recordedDefinition?: RecordedDefinition;
};

const EMPTY_RESUME: ResumeResolution = { activeLeases: [] };

function isNotFoundError(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

/** A create still running in the background has no deployment on chain to read yet, so the read is repeated until it lands. */
function useGetDeployment(dseq: string | undefined, { isAwaitingCreate }: { isAwaitingCreate: boolean }) {
  return useServices().api.v1.getDeployment.useQuery(
    { dseq: dseq ?? "" },
    // A missing deployment is a definitive 404 — don't retry it, so the not-found handling fires promptly. Transient
    // failures (network, 5xx) still retry.
    {
      enabled: !!dseq,
      retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3,
      refetchInterval: isAwaitingCreate ? PENDING_ACTIVITY_POLL_MS : false
    }
  );
}

export const DEPENDENCIES = { Layout, useRouter, useSnackbar, Snackbar, useGetDeployment, useFlag, useLatestActivitiesQuery };

interface Props {
  /** The resolved configure intent. Its `dseq` (pinned at mount) is the deployment being resumed, if any. */
  intent: DeploymentIntent;
  /**
   * Whether the flow can finish an already-leased deployment by re-sending its manifest — true only for the auto
   * flow with an SDL in hand. When false, a resumed deployment that already has live leases is sent to its detail
   * page instead (a manual visitor, or a cold resume with no SDL to re-send).
   */
  canResume: boolean;
  children: (resume: ResumeResolution) => ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

/** The latched terminal outcome: once set, the guard renders it and stops reacting — the children own the dseq now. */
type Outcome = { kind: "render"; resume: ResumeResolution } | { kind: "redirect" };

/**
 * Resolves how to resume the configure screen for a dseq carried in from the URL, consolidating what used to be
 * split between `RedirectIfLeased` (manual) and `useAutoDeploymentFlow`'s own deployment fetch (auto). It runs a
 * single `getDeployment` and drives one state machine for both branches:
 *
 * - **No dseq** — a fresh start; the children render immediately with no query.
 * - **Not found (404)** — the deployment is gone; strip the dseq from the URL, toast, and fall through to a fresh
 *   deployment (rendered only once the URL has cleared, so no flow ever initializes against the dead dseq).
 * - **Not found but being created**: the activity feed holds its create, still running in the background, so it shows in
 *   progress and is read again until the chain has it.
 * - **Closed** — redirect to the deployment detail page.
 * - **Open with live (non-closed) leases** — already leased: resume so the flow re-sends the manifest when
 *   `canResume`, otherwise redirect to the detail page.
 * - **Open with no live leases** — resume quoting from scratch (no provider reconstruction).
 *
 * The outcome is resolved once, then latched: after it fires, the guard ignores later URL/query changes so the
 * children (which now own the dseq — creating one on a fresh start, closing/recreating on "Try again") can't flip the
 * guard back to a spinner or a stale redirect. Scoped to the dseq present at mount, so a dseq created during this
 * session never re-engages the gate. The owner is resolved from auth by the API, so this needs no wallet.
 */
export const ResumeDeploymentGuard: FC<Props> = ({ intent, canResume, children, dependencies: d = DEPENDENCIES }) => {
  const router = d.useRouter();
  const { enqueueSnackbar } = d.useSnackbar();
  const [resumeDseq] = useState(() => intent.dseq);

  // A fresh start (no dseq at mount) resolves synchronously; a resume waits for the deployment to load.
  const [outcome, setOutcome] = useState<Outcome | null>(() => (resumeDseq ? null : { kind: "render", resume: EMPTY_RESUME }));
  const notifiedRef = useRef(false);
  const [isAwaitingCreate, setIsAwaitingCreate] = useState(false);
  const query = d.useGetDeployment(resumeDseq, { isAwaitingCreate: isAwaitingCreate && !outcome });
  const isFollowingFeed = d.useFlag("notifications_activity_center");
  const feed = d.useLatestActivitiesQuery({ enabled: isFollowingFeed && !outcome && isNotFoundError(query.error) });
  const creates = isFollowingFeed ? { activities: feed.data, isUnavailable: feed.isError } : null;

  const decision = useMemo(
    () => resolveDecision(resumeDseq, query, canResume, creates),
    [resumeDseq, query.data, query.isError, query.error, canResume, isFollowingFeed, feed.data, feed.isError]
  );

  useEffect(
    function latchOutcome() {
      if (outcome) return;

      switch (decision.kind) {
        case "loading":
          return;
        case "creating":
          setIsAwaitingCreate(true);
          return;
        case "render":
          setOutcome({ kind: "render", resume: decision.resume });
          return;
        case "redirect":
          if (resumeDseq) router.replace(UrlService.deploymentDetails(resumeDseq));
          setOutcome({ kind: "redirect" });
          return;
        case "notFound":
          // Strip the dead dseq and toast once, then latch to a fresh start only after the URL has cleared — so the
          // children never mount against the deployment that no longer exists, and a dseq they create afterwards can't
          // re-trip the gate.
          if (!notifiedRef.current) {
            notifiedRef.current = true;
            enqueueSnackbar(
              <d.Snackbar title="Deployment not found" subTitle="It may have been closed. Starting a new deployment instead." iconVariant="error" />,
              { variant: "warning" }
            );
            router.replace(buildConfigureUrl(intent, undefined, intent.bidStrategy));
          }
          if (!intent.dseq) setOutcome({ kind: "render", resume: EMPTY_RESUME });
          return;
      }
    },
    [outcome, decision, resumeDseq, intent, router, enqueueSnackbar, d]
  );

  if (outcome?.kind === "render") {
    return <>{children(outcome.resume)}</>;
  }

  return (
    <d.Layout background="white" disableContainer containerClassName="flex min-h-page-viewport flex-col lg:h-page-viewport">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <Spinner size="large" />
        {!outcome && decision.kind === "creating" && (
          <>
            <h1 className="text-lg font-semibold">Creating your deployment</h1>
            <p className="text-sm text-muted-foreground">You can leave this page. We&apos;ll let you know when it&apos;s ready.</p>
          </>
        )}
      </div>
    </d.Layout>
  );
};

type Decision = { kind: "loading" } | { kind: "creating" } | { kind: "render"; resume: ResumeResolution } | { kind: "redirect" } | { kind: "notFound" };

/** What the activity feed says about the user's creates; null while the feed is not followed. */
type CreatesInFeed = { activities?: Activity[]; isUnavailable: boolean } | null;

type DeploymentResponse = NonNullable<ReturnType<typeof useGetDeployment>["data"]>["data"];

/**
 * Classifies the deployment query into a resume decision (side-effect free). Errors are split so only a genuine 404
 * wipes the dseq: a transient failure falls through to a best-effort resume (the children re-quote the existing dseq)
 * rather than discarding it — the server's create-lease is idempotent, so this can't produce a duplicate lease.
 */
function resolveDecision(resumeDseq: string | undefined, query: ReturnType<typeof useGetDeployment>, canResume: boolean, creates: CreatesInFeed): Decision {
  if (!resumeDseq) return { kind: "render", resume: EMPTY_RESUME };
  if (query.isError) return isNotFoundError(query.error) ? resolveMissingDeployment(resumeDseq, creates) : { kind: "render", resume: EMPTY_RESUME };

  const data = query.data?.data;
  if (!data) return { kind: "loading" };
  if (data.deployment.state === "closed") return { kind: "redirect" };

  const liveLeases = data.leases.filter(lease => lease.state !== "closed");
  if (liveLeases.length === 0) return { kind: "render", resume: { activeLeases: [], ...recordedDefinitionOf(data) } };
  if (!canResume) return { kind: "redirect" };
  return {
    kind: "render",
    resume: { activeLeases: liveLeases.map(lease => ({ dseq: lease.id.dseq, gseq: lease.id.gseq, oseq: lease.id.oseq, provider: lease.id.provider })) }
  };
}

/** The chain can lag a create the feed already reports succeeded, so only a create that failed or was never made reads as missing. */
function resolveMissingDeployment(resumeDseq: string, creates: CreatesInFeed): Decision {
  if (!creates || creates.isUnavailable) return { kind: "notFound" };
  if (!creates.activities) return { kind: "loading" };

  const isBeingCreated = creates.activities.some(
    ({ type, status, meta }) => type === "deployment_create" && status !== "failed" && meta.dseq === resumeDseq
  );
  return isBeingCreated ? { kind: "creating" } : { kind: "notFound" };
}

/** A copy recorded under an older version would lease a superseded document, and one with a value blanked out has lost it for good. */
function recordedDefinitionOf(data: DeploymentResponse): { recordedDefinition?: RecordedDefinition } {
  const recorded = data.consoleSettings;
  if (!recorded || recorded.manifestVersion !== data.deployment.hash || !isStoredSdlRedeployable(recorded.sdl)) return {};
  return { recordedDefinition: { sdl: recorded.sdl, ...(data.name ? { name: data.name } : {}) } };
}
