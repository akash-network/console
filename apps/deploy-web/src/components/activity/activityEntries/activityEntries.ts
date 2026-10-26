import { activityDestinationOf, SUMMARY_DESTINATION } from "@src/components/activity/activityDestinations/activityDestinations";
import { listOf, systemCloseOf } from "@src/components/activity/activityLabels/activityLabels";
import { describeDeploymentChanges, renameTitleOf } from "@src/components/activity/deploymentChanges/deploymentChanges";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import { capitalizeFirstLetter } from "@src/utils/stringUtils";

/** `partial` is a bulk close that closed some of its deployments and not others. */
export type ActivityEntryStatus = Activity["status"] | "partial";

/** The glyph standing in for an avatar on an entry no member caused: a close Console made, or an alert that fired. */
export type ActivityEntrySystemIcon = "clock" | "wallet" | "bell" | "activity";

export interface ActivityEntry {
  id: string;
  status: ActivityEntryStatus;
  title: string;
  detail?: string;
  changeSummary?: string;
  systemIcon?: ActivityEntrySystemIcon;
  href: string;
  createdAt: string;
  isUnseen: boolean;
}

type LabelDeployment = (dseq: string | undefined) => string;

type ActionType = Exclude<Activity["type"], `${string}_alert` | "deployment_rename">;

type AlertType = Extract<Activity["type"], `${string}_alert`>;

const ENTRY_WORDING = {
  deployment_close: { pending: "Closing", succeeded: "Closed", failed: "Couldn't close", retry: "Try closing it again." },
  deployment_create: { pending: "Creating", succeeded: "Created", failed: "Couldn't create", retry: "Try creating it again." },
  deployment_update: { pending: "Updating", succeeded: "Updated", failed: "Couldn't update", retry: "Try updating it again." },
  lease_create: { pending: "Deploying", succeeded: "Deployed", failed: "Couldn't deploy", retry: "Choose a provider again." }
} satisfies Record<ActionType, { pending: string; succeeded: string; failed: string; retry: string }>;

const SYSTEM_CLOSE_ICONS = new Map<string | undefined, ActivityEntrySystemIcon>([
  ["runtime_limit_reached", "clock"],
  ["trial_ended", "wallet"]
]);

const DEPLOYMENT_ALERT_WORDING: Partial<Record<AlertType, (deployment: string) => Pick<ActivityEntry, "title" | "detail">>> = {
  deployment_closed_alert: deployment => ({ title: `${deployment} was closed` }),
  deployment_reclaim_alert: deployment => ({ title: `${deployment} is being reclaimed by the provider`, detail: "Take action before the lease is closed." })
};

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

export function activityEntryOf(activity: Activity, labelDeployment: LabelDeployment): ActivityEntry {
  const { id, type, status, initiator, meta, createdAt } = activity;
  const common = { id, status, href: activityDestinationOf(activity).href, createdAt, isUnseen: isUnseen(activity) };

  if (type === "deployment_rename") return { ...common, title: renameEntryTitleOf(meta, labelDeployment) };
  if (!isActionType(type))
    return { ...common, ...alertWordingOf(type, meta, labelDeployment), systemIcon: type === "wallet_balance_alert" ? "wallet" : "bell" };

  const wording = ENTRY_WORDING[type];
  const deployment = labelDeployment(meta.dseq);

  if (initiator === "system") return { ...common, ...systemCloseOf(deployment, meta.reason), systemIcon: SYSTEM_CLOSE_ICONS.get(meta.reason) ?? "activity" };
  if (status === "pending") return { ...common, title: `${wording.pending} ${deployment}` };
  if (status === "succeeded") return { ...common, title: `${wording.succeeded} ${deployment}`, ...changeSummaryOf(describeDeploymentChanges(meta.changes)) };

  return { ...common, title: `${wording.failed} ${deployment}`, detail: meta.error?.message ?? wording.retry };
}

function alertWordingOf(type: AlertType, { dseq, summary }: Activity["meta"], labelDeployment: LabelDeployment): Pick<ActivityEntry, "title" | "detail"> {
  const deploymentWording = DEPLOYMENT_ALERT_WORDING[type];
  if (dseq && deploymentWording) return deploymentWording(capitalizeFirstLetter(labelDeployment(dseq)));

  return { title: summary ?? "One of your alerts fired" };
}

function batchEntryOf(batchId: string, batch: Activity[], labelDeployment: LabelDeployment): ActivityEntry {
  const common = { id: `batch:${batchId}`, href: SUMMARY_DESTINATION.href, createdAt: batch[0].createdAt, isUnseen: batch.some(isUnseen) };
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

function renameEntryTitleOf({ dseq, changes }: Activity["meta"], labelDeployment: LabelDeployment): string {
  return changes?.name ? renameTitleOf(changes.name) : `Renamed ${labelDeployment(dseq)}`;
}

function changeSummaryOf(changeSummary: string | undefined): Pick<ActivityEntry, "changeSummary"> {
  return changeSummary ? { changeSummary } : {};
}

function isUnseen(activity: Activity): boolean {
  return activity.seenAt === null;
}

function isActionType(type: Activity["type"]): type is ActionType {
  return Object.hasOwn(ENTRY_WORDING, type);
}
