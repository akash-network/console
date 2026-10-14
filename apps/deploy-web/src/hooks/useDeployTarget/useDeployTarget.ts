import { useCallback, useEffect, useMemo } from "react";
import { useAtom } from "jotai";

import { useProjectAccess } from "@src/hooks/useProjectAccess/useProjectAccess";
import { useProjectsUi } from "@src/hooks/useProjectsUi/useProjectsUi";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import { deployTargetProjectIdAtom } from "@src/store/deployTargetStore";
import type { Project } from "@src/types/project";

export const DEPENDENCIES = { useProjectsUi, useProjectsQuery, useProjectAccess };

export interface DeployTarget {
  /** Whether a new deployment must name its project; otherwise the api files it into the default project. */
  isRequired: boolean;
  isLoading: boolean;
  /** A project is required but none of the active organization's projects is chosen. */
  isMissing: boolean;
  organizationName: string;
  /** Whether the picker may offer to create a project, which only owners and admins can. */
  canCreateProject: boolean;
  project: Project | undefined;
  projects: Project[];
  chooseProject: (projectId: string) => void;
  /** Drops the choice so the picker asks again, saying why when there is a reason. */
  forgetProject: (reason?: string) => void;
  /** Why the picker asks again, shown above it. */
  notice?: string;
  /** The deployment already exists and stays in the project it was filed in. */
  isFiled?: boolean;
  /** The projects could not be read, so the picker offers `retry` instead of claiming there are none. */
  isUnreadable?: boolean;
  retry?: () => void;
}

/** The project the new deployment page hands to Configure: the one it was opened for, else none, so the picker asks. */
export function useDeployTarget(
  { requestedProjectId }: { requestedProjectId?: string | null } = {},
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): DeployTarget {
  const d = dependencies;
  const { isEnabled: isRequired, organizationName, canManageProjects } = d.useProjectsUi();
  const projectsQuery = d.useProjectsQuery({ enabled: isRequired });
  const access = d.useProjectAccess();
  const [chosenProjectId, setChosenProjectId] = useAtom(deployTargetProjectIdAtom);

  const projects = useMemo(() => (projectsQuery.data ?? []).filter(project => access.canManageDeployments(project.id)), [projectsQuery.data, access]);
  const targetProjectId = requestedProjectId || chosenProjectId;
  const project = isRequired ? projects.find(candidate => candidate.id === targetProjectId) : undefined;
  const isLoading = isRequired && (projectsQuery.isLoading || access.isLoading);
  const isUnreadable = isRequired && !isLoading && ((!projectsQuery.data && projectsQuery.isError) || access.isError);
  const forgetProject = useCallback(() => setChosenProjectId(null), [setChosenProjectId]);
  const retry = () => (access.isError ? access.retry() : void projectsQuery.refetch());

  useEffect(
    function handOverTheProjectThePageWasOpenedFor() {
      setChosenProjectId((isRequired && requestedProjectId) || null);
    },
    [isRequired, requestedProjectId, setChosenProjectId]
  );

  return {
    isRequired,
    isLoading,
    isMissing: isRequired && !isLoading && !project,
    organizationName,
    canCreateProject: canManageProjects,
    project,
    projects,
    chooseProject: setChosenProjectId,
    forgetProject,
    isUnreadable,
    retry
  };
}
