"use client";
import type { FC } from "react";
import { Skeleton } from "@akashnetwork/ui/components";

import { RecentActivityFeed } from "@src/components/projects/RecentActivityFeed/RecentActivityFeed";
import { useOrganizationActivitiesQuery } from "@src/queries/useOrganizationActivitiesQuery";

export const DEPENDENCIES = { useOrganizationActivitiesQuery, RecentActivityFeed };

export interface DeploymentActivityFeedProps {
  dseq: string;
  className?: string;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentActivityFeed: FC<DeploymentActivityFeedProps> = ({ dseq, className, dependencies: d = DEPENDENCIES }) => {
  const feed = d.useOrganizationActivitiesQuery({ dseq });

  return (
    <div className={className}>
      {feed.isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" data-testid="deployment-activity-skeleton" />
      ) : (
        <d.RecentActivityFeed
          activities={feed.activities}
          projects={[]}
          hasMore={feed.hasMore}
          onShowMore={feed.showMore}
          isError={feed.isError}
          onRetry={feed.retry}
          showsProjects={false}
        />
      )}
    </div>
  );
};
