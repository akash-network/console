import { isHttpError } from "http-errors";

import type { NewActivity } from "@src/activity/model-schemas";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";

type CloseKey = { userId: string; dseq: string; batchId?: string };

const UNEXPLAINED_CLOSE_ERROR = { code: "close_failed", message: "The deployment could not be closed." };

const STILL_OPEN_ERROR = { code: "close_incomplete", message: "The deployment is still open. Try closing it again." };

export function closedActivityOf({ userId, dseq, batchId }: CloseKey): NewActivity {
  return { userId, type: "deployment_close", status: "succeeded", meta: { dseq, batchId } };
}

export function stillOpenActivityOf({ userId, dseq, batchId }: CloseKey): NewActivity {
  return { userId, type: "deployment_close", status: "failed", meta: { dseq, batchId, error: STILL_OPEN_ERROR } };
}

/** An undecided close stays pending under its hash, because calling it failed would invite a retry of a close that may have landed. */
export function failedCloseActivityOf({ userId, dseq, batchId }: CloseKey, error: unknown): NewActivity {
  if (isUnknownTxOutcome(error)) {
    return { userId, type: "deployment_close", status: "pending", meta: { dseq, batchId, txHash: error.txHash } };
  }

  return { userId, type: "deployment_close", status: "failed", meta: { dseq, batchId, error: explanationOf(error) } };
}

function explanationOf(error: unknown) {
  if (!isHttpError(error) || !error.expose) return UNEXPLAINED_CLOSE_ERROR;

  const { errorCode, data } = error as { errorCode?: string; data?: { errorCode?: string } };
  return { code: data?.errorCode ?? errorCode ?? UNEXPLAINED_CLOSE_ERROR.code, message: error.message };
}
