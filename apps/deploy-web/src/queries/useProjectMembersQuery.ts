import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";
import type { ProjectMember } from "@src/types/project";
import { ORGANIZATION_ACTIVITIES_QUERY_KEY } from "./useOrganizationActivitiesQuery";

/** Equals `api.v1.listProjectMembers.getKey()`, the prefix of every project's grant list. */
export const PROJECT_MEMBERS_QUERY_KEY = ["v1", "listProjectMembers"] as const;

/** The members granted a project; owners and admins reach every project without a grant, so they are not listed. */
export function useProjectMembersQuery(projectId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const { api } = useServices();

  return api.v1.listProjectMembers.useQuery({ id: projectId }, { enabled, select: (response): ProjectMember[] => response.data });
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

/** A grant changes who the project lists and what its activity feed records. */
function invalidateProjectAccessQueries(queryClient: QueryClient) {
  return Promise.all([PROJECT_MEMBERS_QUERY_KEY, ORGANIZATION_ACTIVITIES_QUERY_KEY].map(queryKey => queryClient.invalidateQueries({ queryKey })));
}
