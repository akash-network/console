import { useEffect, useRef } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import type { QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import upperFirst from "lodash/upperFirst";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { QueryKeys } from "@src/queries/queryKeys";
import { type Activity, useLatestActivitiesQuery } from "@src/queries/useLatestActivitiesQuery";

export const DEPENDENCIES = { useFlag, useUser, useWallet, useLatestActivitiesQuery, useDeploymentNames, useSnackbar, useQueryClient };

type FinishedActivity = Activity & { status: Exclude<Activity["status"], "pending"> };

type Announcement = { title: string; subTitle: string };

const ANNOUNCEMENTS: Record<Activity["type"], (activity: FinishedActivity, deploymentName: string | null) => Announcement> = {
  deployment_close: ({ status, meta }, deploymentName) => {
    const deployment = deploymentName ? `“${deploymentName}”` : `deployment ${meta.dseq}`;

    return status === "succeeded"
      ? { title: `${upperFirst(deployment)} closed`, subTitle: "It no longer runs or costs anything." }
      : { title: `Couldn't close ${deployment}`, subTitle: meta.error?.message ?? "Try closing it again." };
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
  const lastSeenStatuses = useRef<Map<string, Activity["status"]>>();

  useEffect(
    function announceFinishedActivities() {
      if (!activities || isLoadingDeploymentNames) return;

      const finished = lastSeenStatuses.current ? findFinishedSince(lastSeenStatuses.current, activities) : [];
      lastSeenStatuses.current = new Map(activities.map(activity => [activity.id, activity.status]));

      for (const activity of finished) {
        const { title, subTitle } = ANNOUNCEMENTS[activity.type](activity, getDeploymentName(activity.meta.dseq));
        const variant = activity.status === "succeeded" ? "success" : "error";
        enqueueSnackbar(<Snackbar title={title} subTitle={subTitle} iconVariant={variant} />, { variant });

        for (const queryKey of queryKeysChangedBy(activity)) {
          queryClient.invalidateQueries({ queryKey });
        }
      }

      function queryKeysChangedBy({ meta: { dseq } }: Activity): QueryKey[] {
        return [
          api.v1.listDeployments.getKey(),
          QueryKeys.getWeeklyDeploymentCostKey(),
          ...(dseq ? [api.v1.getDeployment.getKey({ dseq })] : []),
          ...(address ? [QueryKeys.getDeploymentListKey(address), QueryKeys.getAllLeasesKey(address), QueryKeys.getBalancesKey(address)] : []),
          ...(address && dseq ? [QueryKeys.getDeploymentDetailKey(address, dseq), QueryKeys.getLeasesKey(address, dseq)] : []),
          ...(user?.id ? [QueryKeys.getManagedWalletKey(user.id)] : [])
        ];
      }
    },
    [activities, isLoadingDeploymentNames, getDeploymentName, address, api, enqueueSnackbar, queryClient, user?.id]
  );

  return null;
}

/** An action never seen before counts too, so one that started and finished between two checks is still announced. */
function findFinishedSince(lastSeenStatuses: Map<string, Activity["status"]>, activities: Activity[]): FinishedActivity[] {
  return activities.filter((activity): activity is FinishedActivity => activity.status !== "pending" && lastSeenStatuses.get(activity.id) !== activity.status);
}
