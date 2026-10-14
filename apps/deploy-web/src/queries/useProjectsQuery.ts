import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { Project } from "@src/types/project";
import { PROJECT_NAME_TAKEN_ERROR_CODE } from "@src/types/project";
import { ORGANIZATION_ACTIVITIES_QUERY_KEY } from "./useOrganizationActivitiesQuery";

/** Equals `api.v1.listProjects.getKey()`, for readers that hold a query client but not the SDK. */
export const PROJECTS_QUERY_KEY = ["v1", "listProjects"] as const;

const NAME_TAKEN_STATUS = 409;

/** The active organization's projects the caller may see. */
export function useProjectsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const { api } = useServices();

  return api.v1.listProjects.useQuery(undefined, { enabled, select: (response): Project[] => response.data });
}

/** Creates a project in the active organization, then refreshes the projects and the activity feed that records it. */
export function useCreateProjectMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.createProject.useMutation({
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ORGANIZATION_ACTIVITIES_QUERY_KEY })
      ])
  });
}

/** Renames a project of the active organization; its slug stays the one it was created with. */
export function useUpdateProjectMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.updateProject.useMutation({ onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }) });
}

/** Deletes a project that holds no open deployment; the default project cannot be deleted. */
export function useDeleteProjectMutation() {
  const { api } = useServices();
  const queryClient = useQueryClient();

  return api.v1.deleteProject.useMutation({ onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }) });
}

export function isProjectNameTakenError(error: unknown): boolean {
  return isApiError(error) && error.status === NAME_TAKEN_STATUS && extractApiErrorCode(error) === PROJECT_NAME_TAKEN_ERROR_CODE;
}
