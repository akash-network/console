"use client";
import type { FC, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isApiError } from "@akashnetwork/openapi-sdk";
import { Snackbar, Spinner } from "@akashnetwork/ui/components";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { useServices } from "@src/context/ServicesProvider";
import { UrlService } from "@src/utils/urlUtils";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import { buildConfigureUrl } from "../useDeploymentFlow/useDeploymentFlow";

/** The coordinates identifying a lease, in the same shape the auto flow reconstructs a selection from. */
export type ResumeLease = { dseq: string; gseq: number; oseq: number; provider: string };

export type ResumeResolution = {
  /**
   * Non-closed leases already on chain for a resumed deployment, so the auto flow can reconstruct a selection per
   * group and let the idempotent server create-lease re-send the manifest. Empty on a fresh start, a not-found
   * resume, or an open deployment with no live leases (which re-quotes from scratch).
   */
  activeLeases: ResumeLease[];
};

const EMPTY_RESUME: ResumeResolution = { activeLeases: [] };

function isNotFoundError(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

function useGetDeployment(dseq: string | undefined) {
  return useServices().api.v1.getDeployment.useQuery(
    { dseq: dseq ?? "" },
    // A missing deployment is a definitive 404 — don't retry it, so the not-found handling fires promptly. Transient
    // failures (network, 5xx) still retry.
    { enabled: !!dseq, retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3 }
  );
}

export const DEPENDENCIES = { Layout, useRouter, useSnackbar, Snackbar, useGetDeployment };

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
  const query = d.useGetDeployment(resumeDseq);

  // A fresh start (no dseq at mount) resolves synchronously; a resume waits for the deployment to load.
  const [outcome, setOutcome] = useState<Outcome | null>(() => (resumeDseq ? null : { kind: "render", resume: EMPTY_RESUME }));
  const notifiedRef = useRef(false);

  const decision = useMemo(() => resolveDecision(resumeDseq, query, canResume), [resumeDseq, query.data, query.isError, query.error, canResume]);

  useEffect(
    function latchOutcome() {
      if (outcome) return;

      switch (decision.kind) {
        case "loading":
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
              { variant: "error" }
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
    <d.Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="large" />
      </div>
    </d.Layout>
  );
};

type Decision = { kind: "loading" } | { kind: "render"; resume: ResumeResolution } | { kind: "redirect" } | { kind: "notFound" };

/**
 * Classifies the deployment query into a resume decision (side-effect free). Errors are split so only a genuine 404
 * wipes the dseq: a transient failure falls through to a best-effort resume (the children re-quote the existing dseq)
 * rather than discarding it — the server's create-lease is idempotent, so this can't produce a duplicate lease.
 */
function resolveDecision(resumeDseq: string | undefined, query: ReturnType<typeof useGetDeployment>, canResume: boolean): Decision {
  if (!resumeDseq) return { kind: "render", resume: EMPTY_RESUME };
  if (query.isError) return isNotFoundError(query.error) ? { kind: "notFound" } : { kind: "render", resume: EMPTY_RESUME };

  const data = query.data?.data;
  if (!data) return { kind: "loading" };
  if (data.deployment.state === "closed") return { kind: "redirect" };

  const liveLeases = data.leases.filter(lease => lease.state !== "closed");
  if (liveLeases.length === 0) return { kind: "render", resume: EMPTY_RESUME };
  if (!canResume) return { kind: "redirect" };
  return {
    kind: "render",
    resume: { activeLeases: liveLeases.map(lease => ({ dseq: lease.id.dseq, gseq: lease.id.gseq, oseq: lease.id.oseq, provider: lease.id.provider })) }
  };
}
