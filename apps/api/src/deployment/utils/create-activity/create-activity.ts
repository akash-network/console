import { activityErrorOf } from "@src/activity/lib/activity-error/activity-error";
import type { NewActivity } from "@src/activity/model-schemas";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";

type CreateKey = { userId: string; dseq: string };

const UNEXPLAINED_CREATE_ERROR = { code: "create_failed", message: "Something went wrong on our side. Try creating it again in a moment." };

const NOT_CREATED_ERROR = { code: "create_incomplete", message: "The deployment was not created. Try creating it again." };

export function creatingActivityOf({ userId, dseq }: CreateKey): NewActivity {
  return { userId, type: "deployment_create", status: "pending", meta: { dseq } };
}

export function createdActivityOf({ userId, dseq }: CreateKey): NewActivity {
  return { userId, type: "deployment_create", status: "succeeded", meta: { dseq } };
}

export function notCreatedActivityOf({ userId, dseq }: CreateKey): NewActivity {
  return { userId, type: "deployment_create", status: "failed", meta: { dseq, error: NOT_CREATED_ERROR } };
}

/** An undecided create stays pending under its hash, because calling it failed would invite creating the deployment a second time. */
export function failedCreateActivityOf({ userId, dseq }: CreateKey, error: unknown): NewActivity {
  if (isUnknownTxOutcome(error)) {
    return { userId, type: "deployment_create", status: "pending", meta: { dseq, txHash: error.txHash } };
  }

  return { userId, type: "deployment_create", status: "failed", meta: { dseq, error: activityErrorOf(error, UNEXPLAINED_CREATE_ERROR) } };
}
