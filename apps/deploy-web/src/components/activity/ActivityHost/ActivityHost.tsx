import { useEffect, useRef } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import type { QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import upperFirst from "lodash/upperFirst";
import { useRouter } from "next/navigation";
import type { SnackbarKey } from "notistack";
import { useSnackbar } from "notistack";

import { type ActivityDestination, activityDestinationOf, SUMMARY_DESTINATION } from "@src/components/activity/activityDestinations/activityDestinations";
import { deploymentLabelOf, listOf, systemCloseOf } from "@src/components/activity/activityLabels/activityLabels";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useCloseBatchesBeingSent } from "@src/hooks/useCloseBatches/useCloseBatches";
import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";
import { useFlag } from "@src/hooks/useFlag";
import { useHandledActivityOutcomes } from "@src/hooks/useHandledActivityOutcomes/useHandledActivityOutcomes";
import { useTakeHeldCreateEvent } from "@src/hooks/useHeldCreateEvents/useHeldCreateEvents";
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
  useHandledActivityOutcomes,
  useTakeHeldCreateEvent,
  useSnackbar,
  useQueryClient,
  useRouter
};

type FinishedActivity = Activity & { type: Exclude<Activity["type"], `${string}_alert`>; status: "succeeded" | "failed" };

type Announcement = { title: string; subTitle: string; variant: "success" | "info" | "warning" | "error" };

type LabelDeployment = (dseq: string | undefined) => string;

const ANNOUNCEMENTS: Record<FinishedActivity["type"], (activity: FinishedActivity, labelDeployment: LabelDeployment) => Announcement> = {
  deployment_close: ({ status, initiator, meta }, labelDeployment) => {
    const deployment = labelDeployment(meta.dseq);

    if (initiator === "system") {
      const { title, detail } = systemCloseOf(deployment, meta.reason);
      return { title, subTitle: detail, variant: "info" };
    }

    return status === "succeeded"
      ? { title: `${upperFirst(deployment)} closed`, subTitle: "It no longer runs or costs anything.", variant: "success" }
      : { title: `Couldn't close ${deployment}`, subTitle: meta.error?.message ?? "Try closing it again.", variant: "error" };
  },
  deployment_create: ({ status, meta }, labelDeployment) => {
    const deployment = labelDeployment(meta.dseq);

    return status === "succeeded"
      ? { title: `${upperFirst(deployment)} created`, subTitle: "Choose a provider to start it.", variant: "success" }
      : { title: `Couldn't create ${deployment}`, subTitle: meta.error?.message ?? "Try creating it again.", variant: "error" };
  },
  deployment_update: ({ status, meta }, labelDeployment) => {
    const deployment = labelDeployment(meta.dseq);

    return status === "succeeded"
      ? { title: `${upperFirst(deployment)} updated`, subTitle: "The new configuration is being applied to it.", variant: "success" }
      : { title: `Couldn't update ${deployment}`, subTitle: meta.error?.message ?? "Try updating it again.", variant: "error" };
  },
  lease_create: ({ status, meta }, labelDeployment) => {
    const deployment = labelDeployment(meta.dseq);

    return status === "succeeded"
      ? { title: `${upperFirst(deployment)} deployed`, subTitle: "Its provider is starting it.", variant: "success" }
      : { title: `Couldn't deploy ${deployment}`, subTitle: meta.error?.message ?? "Choose a provider again.", variant: "error" };
  }
};

const BATCH_ANNOUNCEMENTS: Partial<Record<FinishedActivity["type"], (batch: FinishedActivity[], labelDeployment: LabelDeployment) => Announcement>> = {
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
  const { api, analyticsService } = useServices();
  const queryClient = d.useQueryClient();
  const { enqueueSnackbar, closeSnackbar } = d.useSnackbar();
  const router = d.useRouter();
  const { data: activities } = d.useLatestActivitiesQuery({ enabled: isEnabled && !!user?.userId });
  const { getDeploymentName, isLoading: isLoadingDeploymentNames } = d.useDeploymentNames(activities?.map(activity => activity.meta.dseq) ?? []);
  const closeBatchesBeingSent = d.useCloseBatchesBeingSent();
  const { isOutcomeHandled, isFollowedOnItsPage, forgetHandledOutcome } = d.useHandledActivityOutcomes();
  const takeHeldCreateEvent = d.useTakeHeldCreateEvent();
  const lastSeenStatuses = useRef<Map<string, Activity["status"]>>();
  const batchesToSumUp = useRef(new Set<string>());

  useEffect(
    function announceFinishedActivities() {
      if (!activities || isLoadingDeploymentNames) return;

      const lastSeen = lastSeenStatuses.current;
      lastSeenStatuses.current = new Map(activities.map(activity => [activity.id, activity.status]));
      if (!lastSeen) return;

      for (const activity of findFinishedSince(lastSeen, activities)) {
        for (const queryKey of queryKeysChangedBy(activity)) {
          queryClient.invalidateQueries({ queryKey });
        }
        trackHeldCreateEvent(activity);

        if (activity.meta.batchId) {
          batchesToSumUp.current.add(activity.meta.batchId);
          continue;
        }

        const isFollowedToItsEnd = isFollowedOnItsPage(activity);
        const isShownOnItsPage = isFollowedToItsEnd || isOutcomeHandled(activity);
        if (isShownOnItsPage) forgetHandledOutcome(activity);
        if (!isShownOnItsPage || (!isFollowedToItsEnd && lastSeen.has(activity.id))) announceActivity(activity);
      }

      for (const batchId of batchesToSumUp.current) {
        if (closeBatchesBeingSent.has(batchId)) continue;

        const batch = finishedBatchOf(activities, batchId);
        if (!batch) continue;

        batchesToSumUp.current.delete(batchId);
        const [first, ...rest] = batch;
        if (!first) continue;

        const announceBatch = BATCH_ANNOUNCEMENTS[first.type];
        if (rest.length === 0 || !announceBatch) announceActivity(first);
        else announce(announceBatch(batch, labelDeployment), SUMMARY_DESTINATION);
      }

      function announceActivity(activity: FinishedActivity) {
        announce(ANNOUNCEMENTS[activity.type](activity, labelDeployment), activityDestinationOf(activity));
      }

      function announce({ title, subTitle, variant }: Announcement, destination: ActivityDestination) {
        const key = enqueueSnackbar(
          <ActivityToast title={title} subTitle={subTitle} iconVariant={variant} actionLabel={destination.label} onAction={() => follow(destination, key)} />,
          { variant }
        );
      }

      function follow({ href }: ActivityDestination, key: SnackbarKey) {
        router.push(href);
        closeSnackbar(key);
      }

      function trackHeldCreateEvent({ id, status }: FinishedActivity) {
        const createdEvent = takeHeldCreateEvent(id);
        if (createdEvent && status === "succeeded") analyticsService.track("create_deployment", createdEvent);
      }

      function labelDeployment(dseq: string | undefined) {
        return deploymentLabelOf(getDeploymentName(dseq), dseq);
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
    [
      activities,
      isLoadingDeploymentNames,
      getDeploymentName,
      closeBatchesBeingSent,
      isOutcomeHandled,
      isFollowedOnItsPage,
      forgetHandledOutcome,
      takeHeldCreateEvent,
      address,
      api,
      analyticsService,
      enqueueSnackbar,
      closeSnackbar,
      router,
      queryClient,
      user?.id
    ]
  );

  return null;
}

function ActivityToast({
  title,
  subTitle,
  iconVariant,
  actionLabel,
  onAction
}: {
  title: string;
  subTitle: string;
  iconVariant: Announcement["variant"];
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Snackbar
      title={title}
      iconVariant={iconVariant}
      subTitle={
        <>
          <div>{subTitle}</div>
          <Button className="mt-2 h-7 px-3 text-xs" onClick={onAction}>
            {actionLabel}
          </Button>
        </>
      }
    />
  );
}

/** An action never seen before counts too, so one that finished between two checks, or a close Console made, is still announced, unless the page that sent it already showed how it ended. */
function findFinishedSince(lastSeenStatuses: Map<string, Activity["status"]>, activities: Activity[]): FinishedActivity[] {
  return activities.filter((activity): activity is FinishedActivity => isFinished(activity) && lastSeenStatuses.get(activity.id) !== activity.status);
}

/** Undefined while any action of the batch is still pending. */
function finishedBatchOf(activities: Activity[], batchId: string): FinishedActivity[] | undefined {
  const batch = activities.filter(activity => activity.meta.batchId === batchId);
  return batch.every(isFinished) ? batch : undefined;
}

/** An alert arrives as `info` with nothing left to finish, so it is never announced and refreshes nothing. */
function isFinished(activity: Activity): activity is FinishedActivity {
  return activity.status === "succeeded" || activity.status === "failed";
}
