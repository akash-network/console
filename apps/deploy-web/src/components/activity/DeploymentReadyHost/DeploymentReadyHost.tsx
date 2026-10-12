import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import upperFirst from "lodash/upperFirst";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";

import { deploymentLabelOf } from "@src/components/activity/activityLabels/activityLabels";
import { ActivityToast } from "@src/components/activity/ActivityToast/ActivityToast";
import { useDeploymentsReadiness } from "@src/hooks/useDeploymentsReadiness/useDeploymentsReadiness";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { QueryKeys } from "@src/queries/queryKeys";
import { type Activity, useActivityFeedQuery } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useFlag, useUser, useActivityFeedQuery, useDeploymentsReadiness, useSnackbar, useQueryClient, useRouter };

/** A deploy that went through this long ago is left to the deployment's own page, so a feed of old deploys never fans out into checks on each. */
const READY_WATCH_WINDOW_MS = 30 * 60 * 1000;

/**
 * Tells the user when a deployment they deployed has every service ready, wherever they are in the app. Only a
 * deployment seen spinning up gets the news, so one already running when the app loaded is never announced.
 */
export function DeploymentReadyHost({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const isEnabled = d.useFlag("notifications_activity_center");
  const { user } = d.useUser();
  const isFollowingFeed = isEnabled && !!user?.userId;
  const { data: feed } = d.useActivityFeedQuery({ enabled: isFollowingFeed });
  const activities = isFollowingFeed ? feed?.activities : undefined;
  const [settledDseqs, setSettledDseqs] = useState<ReadonlySet<string>>(() => new Set());
  const launchingDseqs = useMemo(() => launchingDseqsOf(activities ?? []).filter(dseq => !settledDseqs.has(dseq)), [activities, settledDseqs]);
  const launches = d.useDeploymentsReadiness(launchingDseqs);
  const spinningUpDseqs = useRef(new Set<string>());
  const { enqueueSnackbar, closeSnackbar } = d.useSnackbar();
  const queryClient = d.useQueryClient();
  const router = d.useRouter();

  useEffect(
    function announceDeploymentsThatBecameReady() {
      const settled = launches.filter(({ readiness }) => readiness === "ready" || readiness === "stopped");

      for (const { dseq, name, readiness } of launches) {
        if (readiness === "starting") spinningUpDseqs.current.add(dseq);
        if (readiness !== "ready" || !spinningUpDseqs.current.has(dseq)) continue;

        spinningUpDseqs.current.delete(dseq);
        announceReady(dseq, name);
      }

      if (settled.length > 0) setSettledDseqs(current => new Set([...current, ...settled.map(({ dseq }) => dseq)]));

      function announceReady(dseq: string, name: string | null) {
        queryClient.invalidateQueries({ queryKey: QueryKeys.getDeploymentLeaseStatusesKey(dseq) });
        const key = enqueueSnackbar(
          <ActivityToast
            title={`${upperFirst(deploymentLabelOf(name, dseq))} is ready`}
            subTitle="Its services are up and running."
            iconVariant="success"
            actionLabel="View deployment"
            onAction={() => {
              router.push(UrlService.deploymentDetails(dseq));
              closeSnackbar(key);
            }}
          />,
          { variant: "success" }
        );
      }
    },
    [launches, enqueueSnackbar, closeSnackbar, queryClient, router]
  );

  return null;
}

/** The newest deploy of each deployment decides, as the feed lists newest first, so a retry replaces the attempt before it. */
function launchingDseqsOf(activities: Activity[]): string[] {
  const newestDeploys = new Map<string, Activity>();
  for (const activity of activities) {
    const { dseq } = activity.meta;
    if (activity.type === "lease_create" && dseq && !newestDeploys.has(dseq)) newestDeploys.set(dseq, activity);
  }

  return [...newestDeploys].filter(([, deploy]) => isLaunching(deploy)).map(([dseq]) => dseq);
}

function isLaunching({ status, updatedAt }: Activity): boolean {
  return status === "pending" || (status === "succeeded" && Date.now() - Date.parse(updatedAt) < READY_WATCH_WINDOW_MS);
}
