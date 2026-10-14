import { isHttpError } from "http-errors";

import { deploymentCloseDedupeKeyOf } from "@src/activity/lib/dedupe-key/dedupe-key";
import type { ActivityMeta, ActivityStatus, NewActivity, SystemCloseReason } from "@src/activity/model-schemas";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";

/** `owner` is the address the deployment is closed from, the wallet the request acted through rather than the user who asked. */
export type CloseKey = { userId: string; owner: string; dseq: string; batchId?: string };

type SystemCloseKey = { userId: string; owner: string; dseq: string; reason: SystemCloseReason };

const UNEXPLAINED_CLOSE_ERROR = { code: "close_failed", message: "Something went wrong on our side. Try closing it again in a moment." };

const STILL_OPEN_ERROR = { code: "close_incomplete", message: "The deployment is still open. Try closing it again." };

/** A failed close gives up the dedupe key, so the next close of the deployment can open its own row while at most one pending or succeeded row stands for it. */
function userCloseActivityOf({ userId, owner, dseq }: CloseKey, status: ActivityStatus, meta: ActivityMeta): NewActivity {
  return { userId, type: "deployment_close", status, initiator: "user", meta, dedupeKey: status === "failed" ? null : deploymentCloseDedupeKeyOf({ owner, dseq }) };
}

export function pendingCloseActivityOf(key: CloseKey): NewActivity {
  return userCloseActivityOf(key, "pending", { dseq: key.dseq, batchId: key.batchId });
}

export function closedActivityOf(key: CloseKey): NewActivity {
  return userCloseActivityOf(key, "succeeded", { dseq: key.dseq, batchId: key.batchId });
}

export function systemClosedActivityOf({ userId, owner, dseq, reason }: SystemCloseKey): NewActivity {
  return { userId, type: "deployment_close", status: "succeeded", initiator: "system", meta: { dseq, reason }, dedupeKey: deploymentCloseDedupeKeyOf({ owner, dseq }) };
}

export function stillOpenActivityOf(key: CloseKey): NewActivity {
  return userCloseActivityOf(key, "failed", { dseq: key.dseq, batchId: key.batchId, error: STILL_OPEN_ERROR });
}

/** An undecided close stays pending under its hash, because calling it failed would invite a retry of a close that may have landed. */
export function failedCloseActivityOf(key: CloseKey, error: unknown): NewActivity {
  if (isUnknownTxOutcome(error)) {
    return userCloseActivityOf(key, "pending", { dseq: key.dseq, batchId: key.batchId, txHash: error.txHash });
  }

  return userCloseActivityOf(key, "failed", { dseq: key.dseq, batchId: key.batchId, error: explanationOf(error) });
}

function explanationOf(error: unknown) {
  if (!isHttpError(error) || !error.expose) return UNEXPLAINED_CLOSE_ERROR;

  const { errorCode, data } = error as { errorCode?: string; data?: { errorCode?: string } };
  return { code: data?.errorCode ?? errorCode ?? UNEXPLAINED_CLOSE_ERROR.code, message: error.message };
}
