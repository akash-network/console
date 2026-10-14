import { useServices } from "@src/context/ServicesProvider";
import type { ProjectMember } from "@src/types/project";

/** The members granted a project; owners and admins reach every project without a grant, so they are not listed. */
export function useProjectMembersQuery(projectId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const { api } = useServices();

  return api.v1.listProjectMembers.useQuery({ id: projectId }, { enabled, select: (response): ProjectMember[] => response.data });
}
