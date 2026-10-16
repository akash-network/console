import { type HttpError, isHttpError } from "http-errors";

import { errorCodeOf } from "@src/activity/lib/activity-error/activity-error";
import type { ActivityMeta, ActivityStatus, NewActivity } from "@src/activity/model-schemas";
import { isUnknownTxOutcome, TxNotIncludedError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";

/** `userId` is the member who asked for the create, whose feed reports it whichever wallet it was made with. */
type CreateKey = { userId: string; dseq: string };

const CREATE_FAILED_CODE = "create_failed";

const NOT_CREATED_ERROR = { code: "create_incomplete", message: "The deployment was not created. Try creating it again." };

function userCreateActivityOf({ userId }: CreateKey, status: ActivityStatus, meta: ActivityMeta): NewActivity {
  return { userId, type: "deployment_create", status, initiator: "user", meta, dedupeKey: null };
}

export function creatingActivityOf(key: CreateKey): NewActivity {
  return userCreateActivityOf(key, "pending", { dseq: key.dseq });
}

export function createdActivityOf(key: CreateKey): NewActivity {
  return userCreateActivityOf(key, "succeeded", { dseq: key.dseq });
}

export function notCreatedActivityOf(key: CreateKey): NewActivity {
  return userCreateActivityOf(key, "failed", { dseq: key.dseq, error: NOT_CREATED_ERROR });
}

/** Bounded below 500, because an undecided outcome is exposed to the caller too and must never read as a refusal. */
export function isCreateRefusal(error: unknown): error is HttpError {
  return isHttpError(error) && error.expose && error.status < 500;
}

/** Only a refusal or a create the signer proved never included is known not to have landed; any other failure, one after the broadcast included, stays pending for the chain to decide. */
export function failedCreateActivityOf(key: CreateKey, error: unknown): NewActivity {
  if (isCreateRefusal(error) || error instanceof TxNotIncludedError) {
    return userCreateActivityOf(key, "failed", { dseq: key.dseq, error: { code: errorCodeOf(error) ?? CREATE_FAILED_CODE, message: error.message } });
  }

  return userCreateActivityOf(key, "pending", isUnknownTxOutcome(error) ? { dseq: key.dseq, txHash: error.txHash } : { dseq: key.dseq });
}
