import { activityErrorOf } from "@src/activity/lib/activity-error/activity-error";
import type { NewActivity } from "@src/activity/model-schemas";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";

type UpdateKey = { userId: string; dseq: string; manifestVersion: string };

const UNEXPLAINED_UPDATE_ERROR = { code: "update_failed", message: "Something went wrong while applying the update. Try updating it again in a moment." };

const NOT_APPLIED_ERROR = { code: "update_incomplete", message: "The update did not go through. Try updating it again." };

const NOT_DELIVERED_ERROR = {
  code: "update_not_delivered",
  message: "The update reached the network, but your provider may not have received it. Try updating it again."
};

export function pendingUpdateActivityOf({ userId, dseq, manifestVersion }: UpdateKey): NewActivity {
  return { userId, type: "deployment_update", status: "pending", meta: { dseq, manifestVersion } };
}

/** Also what an update a newer one replaced settles as, because a patch builds on the saved definition and the newer version carries every edit it made. */
export function updatedActivityOf({ userId, dseq, manifestVersion }: UpdateKey): NewActivity {
  return { userId, type: "deployment_update", status: "succeeded", meta: { dseq, manifestVersion } };
}

/** An undecided update stays pending under its hash, because calling it failed before the chain is asked would report an update that may have landed. */
export function failedUpdateActivityOf({ userId, dseq, manifestVersion }: UpdateKey, error: unknown): NewActivity {
  if (isUnknownTxOutcome(error)) {
    return { userId, type: "deployment_update", status: "pending", meta: { dseq, manifestVersion, txHash: error.txHash } };
  }

  return { userId, type: "deployment_update", status: "failed", meta: { dseq, manifestVersion, error: activityErrorOf(error, UNEXPLAINED_UPDATE_ERROR) } };
}

export function notAppliedUpdateActivityOf({ userId, dseq, manifestVersion }: UpdateKey): NewActivity {
  return { userId, type: "deployment_update", status: "failed", meta: { dseq, manifestVersion, error: NOT_APPLIED_ERROR } };
}

/** Failed rather than succeeded, because the attempt that sent the update stopped before the manifest went out, and a repeat of the update only pushes it again. */
export function undeliveredUpdateActivityOf({ userId, dseq, manifestVersion }: UpdateKey): NewActivity {
  return { userId, type: "deployment_update", status: "failed", meta: { dseq, manifestVersion, error: NOT_DELIVERED_ERROR } };
}
