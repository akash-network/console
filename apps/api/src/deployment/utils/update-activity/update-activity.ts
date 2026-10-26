import { activityErrorOf } from "@src/activity/lib/activity-error/activity-error";
import type { ActivityMeta, ActivityStatus, DeploymentChanges, NewActivity } from "@src/activity/model-schemas";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";

/** `changes` is absent for an update saved before they were recorded, or one that only replaced secret values. */
type UpdateKey = { userId: string; dseq: string; manifestVersion: string; changes?: DeploymentChanges };

type RenameKey = { userId: string; dseq: string; from: string; to: string };

const UNEXPLAINED_UPDATE_ERROR = { code: "update_failed", message: "Something went wrong while applying the update. Try updating it again in a moment." };

const NOT_APPLIED_ERROR = { code: "update_incomplete", message: "The update did not go through. Try updating it again." };

const NOT_DELIVERED_ERROR = {
  code: "update_not_delivered",
  message: "The update reached the network, but your provider may not have received it. Try updating it again."
};

/** Every update is its own entry, so none holds a dedupe key. */
function updateActivityOf(
  { userId, dseq, manifestVersion, changes }: UpdateKey,
  status: ActivityStatus,
  meta: Omit<ActivityMeta, "dseq" | "manifestVersion" | "changes"> = {}
): NewActivity {
  return {
    userId,
    type: "deployment_update",
    status,
    initiator: "user",
    meta: { dseq, manifestVersion, ...(changes ? { changes } : {}), ...meta },
    dedupeKey: null
  };
}

export function renamedActivityOf({ userId, dseq, from, to }: RenameKey): NewActivity {
  return { userId, type: "deployment_rename", status: "succeeded", initiator: "user", meta: { dseq, changes: { name: { from, to } } }, dedupeKey: null };
}

export function pendingUpdateActivityOf(key: UpdateKey): NewActivity {
  return updateActivityOf(key, "pending");
}

/** Also what an update a newer one replaced settles as, because a patch builds on the saved definition and the newer version carries every edit it made. */
export function updatedActivityOf(key: UpdateKey): NewActivity {
  return updateActivityOf(key, "succeeded");
}

/** An undecided update stays pending under its hash, because calling it failed before the chain is asked would report an update that may have landed. */
export function failedUpdateActivityOf(key: UpdateKey, error: unknown): NewActivity {
  if (isUnknownTxOutcome(error)) {
    return updateActivityOf(key, "pending", { txHash: error.txHash });
  }

  return updateActivityOf(key, "failed", { error: activityErrorOf(error, UNEXPLAINED_UPDATE_ERROR) });
}

export function notAppliedUpdateActivityOf(key: UpdateKey): NewActivity {
  return updateActivityOf(key, "failed", { error: NOT_APPLIED_ERROR });
}

/** Failed rather than succeeded, because the attempt that sent the update stopped before the manifest went out, and a repeat of the update only pushes it again. */
export function undeliveredUpdateActivityOf(key: UpdateKey): NewActivity {
  return updateActivityOf(key, "failed", { error: NOT_DELIVERED_ERROR });
}
