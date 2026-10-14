import { useCallback } from "react";
import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import { useQueries, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { isClientError, SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";
import type { ProjectMember, ProjectRole } from "@src/types/project";
import { ORGANIZATION_ACTIVITIES_QUERY_KEY } from "./useOrganizationActivitiesQuery";

/** Equals `api.v1.listProjectMembers.getKey()`, the prefix of every project's grant list. */
export const PROJECT_MEMBERS_QUERY_KEY = ["v1", "listProjectMembers"] as const;

/** Every grant change this client makes refreshes the lists at once, so the per-project role reads only catch other people's changes. */
const PROJECT_ROLES_STALE_TIME_MS = 60_000;

type ProjectMembersResponse = { data: ProjectMember[] };

export interface ProjectRolesOfUser {
  isLoading: boolean;
  /** A grant list failed to load, so the user's role in that project stays unknown until `retry` reads it again. */
  isError: boolean;
  retry: () => void;
  rolesByProjectId: ReadonlyMap<string, ProjectRole>;
}

/** The members granted a project; owners and admins reach every project without a grant, so they are not listed. */
export function useProjectMembersQuery(projectId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const { api } = useServices();

  return api.v1.listProjectMembers.useQuery({ id: projectId }, { enabled, select: (response): ProjectMember[] => response.data });
}

/** The role one user was granted in each of the given projects, read from the same grant lists the project page shows. */
export function useProjectRolesOfUser(projectIds: string[], userId: string | undefined, { enabled }: { enabled: boolean }): ProjectRolesOfUser {
  const { api } = useServices();
  const combineRoles = useCallback(
    (results: UseQueryResult<ProjectMembersResponse>[]): ProjectRolesOfUser => {
      const unreadResults = results.filter(isUnreadGrantList);

      return {
        isLoading: results.some(result => result.isLoading),
        isError: unreadResults.length > 0,
        retry: () => unreadResults.forEach(result => void result.refetch()),
        rolesByProjectId: new Map(
          results.flatMap((result, index) => {
            const grant = isRefusedGrantList(result) ? undefined : result.data?.data.find(member => member.userId === userId);
            return grant ? [[projectIds[index], grant.role] as const] : [];
          })
        )
      };
    },
    [projectIds, userId]
  );

  return useQueries({
    queries: projectIds.map(id => ({
      ...api.v1.listProjectMembers.queryOptions({ id }),
      enabled: enabled && !!userId,
      staleTime: PROJECT_ROLES_STALE_TIME_MS,
      meta: SKIP_REPORTING_REFUSED_INPUT
    })),
    combine: combineRoles
  });
}

/** A refused grant list means the project is gone or no longer granted, which answers "no role" even over a role read earlier. */
function isRefusedGrantList(result: UseQueryResult<ProjectMembersResponse>) {
  return result.isError && isClientError(result.error);
}

function isUnreadGrantList(result: UseQueryResult<ProjectMembersResponse>) {
  return !result.data && result.isError && !isRefusedGrantList(result);
}

export function useCreateProjectMemberMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.createProjectMember.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () => invalidateProjectAccessQueries(queryClient)
  });
}

export function useUpdateProjectMemberMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.updateProjectMember.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () => invalidateProjectAccessQueries(queryClient)
  });
}

export function useDeleteProjectMemberMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.deleteProjectMember.useMutation({
    meta: SKIP_REPORTING_REFUSED_INPUT,
    onSuccess: () => invalidateProjectAccessQueries(queryClient)
  });
}

/** A grant changes who the project lists and what its activity feed records, and the caller's own rights are derived from the same lists. */
function invalidateProjectAccessQueries(queryClient: QueryClient) {
  return Promise.all([PROJECT_MEMBERS_QUERY_KEY, ORGANIZATION_ACTIVITIES_QUERY_KEY].map(queryKey => queryClient.invalidateQueries({ queryKey })));
}
