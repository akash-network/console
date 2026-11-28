import { useInfiniteQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { OrganizationActivitiesPage, OrganizationActivity, OrganizationActivityActor } from "@src/types/organization-activity";

/** Equals `api.v1.listOrganizationActivities.getKey()`, for readers that hold a query client but not the SDK. */
export const ORGANIZATION_ACTIVITIES_QUERY_KEY = ["v1", "listOrganizationActivities"] as const;

export const ACTIVITY_PAGE_SIZE = 8;

export interface OrganizationActivitiesFeed {
  activities: OrganizationActivity[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  showMore: () => void;
  retry: () => void;
}

export interface DeploymentCreation {
  /** Null for a member who has since deleted their account. */
  actor: OrganizationActivityActor | null;
  createdAt: string;
}

/** The active organization's activity, or one project's or deployment's, newest first, a page at a time. */
export function useOrganizationActivitiesQuery(params: { projectId?: string; dseq?: string } = {}): OrganizationActivitiesFeed {
  const { api } = useServices();
  const query = useInfiniteQuery({
    queryKey: [...ORGANIZATION_ACTIVITIES_QUERY_KEY, params],
    queryFn: ({ pageParam }): Promise<OrganizationActivitiesPage> =>
      api.v1.listOrganizationActivities.queryOptions({ ...params, limit: ACTIVITY_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) }).queryFn(),
    initialPageParam: null as string | null,
    getNextPageParam: lastPage => lastPage.nextCursor
  });

  return {
    activities: query.data?.pages.flatMap(page => page.data) ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: query.hasNextPage,
    showMore: () => {
      void query.fetchNextPage({ cancelRefetch: false });
    },
    retry: () => {
      void query.refetch();
    }
  };
}

/** Who deployed it and when, read off its creation activity; null for a deployment created before the console recorded one. */
export function useDeploymentCreationQuery(dseq: string, { enabled = true }: { enabled?: boolean } = {}) {
  const { api } = useServices();

  return api.v1.listOrganizationActivities.useQuery(
    { dseq, type: "deployment_created", limit: 1 },
    { enabled, select: (page): DeploymentCreation | null => toDeploymentCreation(page.data[0]) }
  );
}

function toDeploymentCreation(activity: OrganizationActivity | undefined): DeploymentCreation | null {
  return activity ? { actor: activity.actor, createdAt: activity.createdAt } : null;
}
