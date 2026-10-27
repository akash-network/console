import { isHttpError } from "http-errors";

import type { ActivityMeta, ActivityStatus, NewActivity } from "@src/activity/model-schemas";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { LeasePlacement } from "@src/deployment/utils/lease-placement/lease-placement";

type LeaseKey = { userId: string; leases: LeasePlacement[] };

const UNEXPLAINED_LEASE_ERROR = { code: "lease_create_failed", message: "Something went wrong on our side. Choose a provider again in a moment." };

const LEASE_NOT_CREATED_ERROR = { code: "lease_not_created", message: "The lease was not created. Choose a provider again." };

/** No dedupe key, since the lease job's singleton already keeps one pending row per deployment. */
function leaseActivityOf(userId: string, status: ActivityStatus, meta: ActivityMeta): NewActivity {
  return { userId, type: "lease_create", status, initiator: "user", meta, dedupeKey: null };
}

/** Why Console gave up picking a provider for a one-click deploy; the deployment is closed by then in every case. */
export const UNMATCHED_LEASE_ERRORS = {
  noBids: { code: "no_provider_bids", message: "No provider bid on this deployment in time, so it was closed. Deploy it again to try once more." },
  noReachableProvider: {
    code: "no_reachable_provider",
    message: "No provider that bid on this deployment answered in time, so it was closed. Deploy it again to try once more."
  },
  deploymentClosed: { code: "deployment_closed", message: "The deployment was closed before a provider was picked for it." }
} as const;

export type UnmatchedLeaseReason = keyof typeof UNMATCHED_LEASE_ERRORS;

type MatchKey = { userId: string; dseq: string };

/** Opened before Console has picked anyone, so an empty providers list is what tells a client the match is still running. */
export function matchingLeaseActivityOf({ userId, dseq }: MatchKey): NewActivity {
  return leaseActivityOf(userId, "pending", { dseq, providers: [] });
}

export function unmatchedLeaseActivityOf({ userId, dseq }: MatchKey, reason: UnmatchedLeaseReason): NewActivity {
  return leaseActivityOf(userId, "failed", { dseq, providers: [], error: UNMATCHED_LEASE_ERRORS[reason] });
}

export function pendingLeaseActivityOf({ userId, leases }: LeaseKey): NewActivity {
  return leaseActivityOf(userId, "pending", metaOf(leases));
}

export function createdLeaseActivityOf({ userId, leases }: LeaseKey): NewActivity {
  return leaseActivityOf(userId, "succeeded", metaOf(leases));
}

export function notCreatedLeaseActivityOf({ userId, leases }: LeaseKey): NewActivity {
  return leaseActivityOf(userId, "failed", { ...metaOf(leases), error: LEASE_NOT_CREATED_ERROR });
}

/** For leases that landed after their request answered undecided, which therefore never sent their manifest. */
export function undeliveredManifestActivityOf({ userId, leases }: LeaseKey): NewActivity {
  const error = {
    code: "manifest_not_delivered",
    message: `The lease for deployment ${leases[0].dseq} exists, but its manifest was not sent. Send the lease request again to finish, or close the deployment to stop paying for it.`
  };

  return leaseActivityOf(userId, "failed", { ...metaOf(leases), error });
}

/** An undecided lease stays pending under its hash, because calling it failed would invite choosing another provider for a deployment that may already have its lease. */
export function failedLeaseActivityOf({ userId, leases }: LeaseKey, error: unknown): NewActivity {
  if (isUnknownTxOutcome(error)) {
    return leaseActivityOf(userId, "pending", { ...metaOf(leases), txHash: error.txHash });
  }

  return leaseActivityOf(userId, "failed", { ...metaOf(leases), error: explanationOf(error) });
}

function metaOf(leases: LeasePlacement[]): ActivityMeta {
  return { dseq: leases[0].dseq, providers: [...new Set(leases.map(lease => lease.provider))] };
}

/** A code names a failure the caller can act on whatever its status, while a bare server error keeps its message to the logs. */
function explanationOf(error: unknown) {
  if (!isHttpError(error)) return UNEXPLAINED_LEASE_ERROR;

  const { errorCode, data } = error as { errorCode?: string; data?: { errorCode?: string } };
  const code = data?.errorCode ?? errorCode;
  if (code) return { code, message: error.message };

  return error.expose ? { code: UNEXPLAINED_LEASE_ERROR.code, message: error.message } : UNEXPLAINED_LEASE_ERROR;
}
