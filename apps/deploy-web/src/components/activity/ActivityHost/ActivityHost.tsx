import { useEffect, useRef } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import type { QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import upperFirst from "lodash/upperFirst";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useCloseBatchesBeingSent } from "@src/hooks/useCloseBatches/useCloseBatches";
import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { QueryKeys } from "@src/queries/queryKeys";
import { type Activity, useLatestActivitiesQuery } from "@src/queries/useLatestActivitiesQuery";

export const DEPENDENCIES = {
  useFlag,
  useUser,
  useWallet,
  useLatestActivitiesQuery,
  useDeploymentNames,
  useCloseBatchesBeingSent,
  useSnackbar,
  useQueryClient
};

type FinishedActivity = Activity & { status: Exclude<Activity["status"], "pending"> };

type Announcement = { title: string; subTitle: string; variant: "success" | "warning" | "error" };

type LabelDeployment = (dseq: string | undefined) => string;

/** A summary naming more deployments than this gets too long to read in a toast, so the rest are counted instead. */
const MAX_NAMED_DEPLOYMENTS = 3;

const ANNOUNCEMENTS: Record<Activity["type"], (activity: FinishedActivity, labelDeployment: LabelDeployment) => Announcement> = {
  deployment_close: ({ status, meta }, labelDeployment) => {
    const deployment = labelDeployment(meta.dseq);

    return status === "succeeded"
      ? { title: `${upperFirst(deployment)} closed`, subTitle: "It no longer runs or costs anything.", variant: "success" }
      : { title: `Couldn't close ${deployment}`, subTitle: meta.error?.message ?? "Try closing it again.", variant: "error" };
  }
};

const BATCH_ANNOUNCEMENTS: Record<Activity["type"], (batch: FinishedActivity[], labelDeployment: LabelDeployment) => Announcement> = {
  deployment_close: (batch, labelDeployment) => {
    const notClosed = batch.filter(activity => activity.status === "failed").map(activity => labelDeployment(activity.meta.dseq));

    if (notClosed.length === 0) {
      return { title: `${batch.length} deployments closed`, subTitle: "They no longer run or cost anything.", variant: "success" };
    }

    if (notClosed.length === batch.length) {
      return { title: `Couldn't close ${batch.length} deployments`, subTitle: `Try closing ${listOf(notClosed)} again.`, variant: "error" };
    }

    return {
      title: `Closed ${batch.length - notClosed.length} of ${batch.length} deployments`,
      subTitle: `Couldn't close ${listOf(notClosed)}.`,
      variant: "warning"
    };
  }
};

/** Tells the user when one of their background actions finishes, wherever they are in the app, and refreshes the data it changed. */
export function ActivityHost({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const isEnabled = d.useFlag("notifications_activity_center");
  const { user } = d.useUser();
  const { address } = d.useWallet();
  const { api } = useServices();
  const queryClient = d.useQueryClient();
  const { enqueueSnackbar } = d.useSnackbar();
  const { data: activities } = d.useLatestActivitiesQuery({ enabled: isEnabled && !!user?.userId });
  const { getDeploymentName, isLoading: isLoadingDeploymentNames } = d.useDeploymentNames(activities?.map(activity => activity.meta.dseq) ?? []);
  const closeBatchesBeingSent = d.useCloseBatchesBeingSent();
  const lastSeenStatuses = useRef<Map<string, Activity["status"]>>();
  const batchesToSumUp = useRef(new Set<string>());

  useEffect(
    function announceFinishedActivities() {
      if (!activities || isLoadingDeploymentNames) return;

      const finished = lastSeenStatuses.current ? findFinishedSince(lastSeenStatuses.current, activities) : [];
      lastSeenStatuses.current = new Map(activities.map(activity => [activity.id, activity.status]));

      for (const activity of finished) {
        for (const queryKey of queryKeysChangedBy(activity)) {
          queryClient.invalidateQueries({ queryKey });
        }

        if (activity.meta.batchId) batchesToSumUp.current.add(activity.meta.batchId);
        else announce(ANNOUNCEMENTS[activity.type](activity, labelDeployment));
      }

      for (const batchId of batchesToSumUp.current) {
        if (closeBatchesBeingSent.has(batchId)) continue;

        const batch = finishedBatchOf(activities, batchId);
        if (!batch) continue;

        batchesToSumUp.current.delete(batchId);
        const [first, ...rest] = batch;
        if (first) announce(rest.length === 0 ? ANNOUNCEMENTS[first.type](first, labelDeployment) : BATCH_ANNOUNCEMENTS[first.type](batch, labelDeployment));
      }

      function announce({ title, subTitle, variant }: Announcement) {
        enqueueSnackbar(<Snackbar title={title} subTitle={subTitle} iconVariant={variant} />, { variant });
      }

      function labelDeployment(dseq: string | undefined) {
        const name = getDeploymentName(dseq);
        return name ? `“${name}”` : `deployment ${dseq}`;
      }

      function queryKeysChangedBy({ meta: { dseq } }: Activity): QueryKey[] {
        return [
          api.v1.listDeployments.getKey(),
          QueryKeys.getWeeklyDeploymentCostKey(),
          api.v1.getSpendRate.getKey(),
          ...(dseq ? [api.v1.getDeployment.getKey({ dseq })] : []),
          ...(address ? [QueryKeys.getDeploymentListKey(address), QueryKeys.getAllLeasesKey(address), QueryKeys.getBalancesKey(address)] : []),
          ...(address && dseq ? [QueryKeys.getDeploymentDetailKey(address, dseq), QueryKeys.getLeasesKey(address, dseq)] : []),
          ...(user?.id ? [QueryKeys.getManagedWalletKey(user.id)] : [])
        ];
      }
    },
    [activities, isLoadingDeploymentNames, getDeploymentName, closeBatchesBeingSent, address, api, enqueueSnackbar, queryClient, user?.id]
  );

  return null;
}

/** An action never seen before counts too, so one that started and finished between two checks is still announced. */
function findFinishedSince(lastSeenStatuses: Map<string, Activity["status"]>, activities: Activity[]): FinishedActivity[] {
  return activities.filter((activity): activity is FinishedActivity => activity.status !== "pending" && lastSeenStatuses.get(activity.id) !== activity.status);
}

/** Undefined while any action of the batch is still pending. */
function finishedBatchOf(activities: Activity[], batchId: string): FinishedActivity[] | undefined {
  const batch = activities.filter(activity => activity.meta.batchId === batchId);
  return batch.every((activity): activity is FinishedActivity => activity.status !== "pending") ? batch : undefined;
}

function listOf(labels: string[]): string {
  if (labels.length > MAX_NAMED_DEPLOYMENTS) return `${labels.slice(0, MAX_NAMED_DEPLOYMENTS).join(", ")} and ${labels.length - MAX_NAMED_DEPLOYMENTS} more`;

  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
