import { useInfiniteQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { OrganizationActivitiesPage, OrganizationActivity } from "@src/types/organization-activity";

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

/** The active organization's activity, or one project's, newest first, a page at a time. */
export function useOrganizationActivitiesQuery(params: { projectId?: string } = {}): OrganizationActivitiesFeed {
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
