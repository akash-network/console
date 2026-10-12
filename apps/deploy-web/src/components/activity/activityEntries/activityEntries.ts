import { listOf } from "@src/components/activity/activityLabels/activityLabels";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";

/** `partial` is a bulk close that closed some of its deployments and not others. */
export type ActivityEntryStatus = Activity["status"] | "partial";

export interface ActivityEntry {
  id: string;
  status: ActivityEntryStatus;
  title: string;
  detail?: string;
  href: string;
  createdAt: string;
}

type LabelDeployment = (dseq: string | undefined) => string;

const ENTRY_WORDING = {
  deployment_close: { pending: "Closing", succeeded: "Closed", failed: "Couldn't close", retry: "Try closing it again.", failedTab: "SETTINGS" },
  deployment_update: { pending: "Updating", succeeded: "Updated", failed: "Couldn't update", retry: "Try updating it again.", failedTab: "UPDATE" }
} satisfies Record<Activity["type"], { pending: string; succeeded: string; failed: string; retry: string; failedTab: string }>;

/** A bulk close reads as one entry, placed where its newest close is, so it never crowds out everything else. */
export function activityEntriesOf(activities: Activity[], labelDeployment: LabelDeployment, limit: number): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  const listedBatchIds = new Set<string>();

  for (const activity of activities) {
    if (entries.length === limit) break;

    const { batchId } = activity.meta;
    if (!batchId) {
      entries.push(activityEntryOf(activity, labelDeployment));
      continue;
    }
    if (listedBatchIds.has(batchId)) continue;

    listedBatchIds.add(batchId);
    const batch = activities.filter(member => member.meta.batchId === batchId);
    entries.push(batch.length === 1 ? activityEntryOf(activity, labelDeployment) : batchEntryOf(batchId, batch, labelDeployment));
  }

  return entries;
}

export function activityEntryOf({ id, type, status, meta, createdAt }: Activity, labelDeployment: LabelDeployment): ActivityEntry {
  const wording = ENTRY_WORDING[type];
  const deployment = labelDeployment(meta.dseq);
  const href = meta.dseq ? UrlService.deploymentDetails(meta.dseq, status === "failed" ? wording.failedTab : undefined) : UrlService.deploymentList();

  if (status === "pending") return { id, status, title: `${wording.pending} ${deployment}`, href, createdAt };
  if (status === "succeeded") return { id, status, title: `${wording.succeeded} ${deployment}`, href, createdAt };

  return { id, status, title: `${wording.failed} ${deployment}`, detail: meta.error?.message ?? wording.retry, href, createdAt };
}

function batchEntryOf(batchId: string, batch: Activity[], labelDeployment: LabelDeployment): ActivityEntry {
  const common = { id: `batch:${batchId}`, href: UrlService.deploymentList(), createdAt: batch[0].createdAt };
  const notClosed = batch.filter(activity => activity.status === "failed").map(activity => labelDeployment(activity.meta.dseq));

  if (batch.some(activity => activity.status === "pending")) return { ...common, status: "pending", title: `Closing ${batch.length} deployments` };
  if (notClosed.length === 0) return { ...common, status: "succeeded", title: `Closed ${batch.length} deployments` };
  if (notClosed.length === batch.length) {
    return { ...common, status: "failed", title: `Couldn't close ${batch.length} deployments`, detail: `Try closing ${listOf(notClosed)} again.` };
  }

  return {
    ...common,
    status: "partial",
    title: `Closed ${batch.length - notClosed.length} of ${batch.length} deployments`,
    detail: `Couldn't close ${listOf(notClosed)}.`
  };
}
