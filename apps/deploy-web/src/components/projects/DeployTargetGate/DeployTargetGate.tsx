"use client";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import type { DeployTarget } from "@src/hooks/useDeployTarget/useDeployTarget";
import { useProjectAccess } from "@src/hooks/useProjectAccess/useProjectAccess";
import { useProjectsUi } from "@src/hooks/useProjectsUi/useProjectsUi";
import { useDeploymentLocationQuery } from "@src/queries/useDeploymentProjectQueries";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import { deployTargetProjectIdAtom } from "@src/store/deployTargetStore";
import type { Project } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import { ChooseProjectModal } from "../ChooseProjectModal/ChooseProjectModal";

export const DEPENDENCIES = {
  useProjectsUi,
  useActiveOrganization,
  useProjectsQuery,
  useProjectAccess,
  useDeploymentLocationQuery,
  useRouter,
  ChooseProjectModal
};

const NO_TARGET: DeployTarget = {
  isRequired: false,
  isLoading: false,
  isMissing: false,
  organizationName: "",
  canCreateProject: false,
  project: undefined,
  projects: [],
  chooseProject: () => undefined,
  forgetProject: () => undefined
};

const DeployTargetContext = createContext<DeployTarget>(NO_TARGET);

/** The project the deployment being configured goes to, as the gate around the configure flow holds it. */
export function useConfigureDeployTarget(): DeployTarget {
  return useContext(DeployTargetContext);
}

interface Props {
  /** A deployment that already exists: the flow runs without waiting, a deployment re-created in its place keeps its project, and the picker opens over the flow when that project can't be used. */
  filedDseq?: string;
  /** Shown in place of the flow until a project is chosen. */
  fallback: ReactNode;
  children: ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

/** Holds the flow back until the organization settles and a project is chosen; once it runs, a refused project reopens the picker over it. */
export function DeployTargetGate({ filedDseq, fallback, children, dependencies: d = DEPENDENCIES }: Props) {
  const router = d.useRouter();
  const { isEnabled: isRequired, organizationName, canManageProjects } = d.useProjectsUi();
  const { isLoading: isOrganizationLoading } = d.useActiveOrganization();
  const projectsQuery = d.useProjectsQuery({ enabled: isRequired });
  const access = d.useProjectAccess();
  const isFiled = !!filedDseq;
  const filedLocationQuery = d.useDeploymentLocationQuery(filedDseq ?? "", { enabled: isRequired && isFiled });
  const [handedOverProjectId, setHandedOverProjectId] = useAtom(deployTargetProjectIdAtom);
  const [projectId, setProjectId] = useState(handedOverProjectId);
  const [isFiledProjectForgotten, setIsFiledProjectForgotten] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [isPickerDismissed, setIsPickerDismissed] = useState(false);
  const [hasLetTheFlowThrough, setHasLetTheFlowThrough] = useState(false);

  useEffect(
    function takeOverTheHandedOverProject() {
      setHandedOverProjectId(null);
    },
    [setHandedOverProjectId]
  );

  const projects = useMemo(() => (projectsQuery.data ?? []).filter(project => access.canManageDeployments(project.id)), [projectsQuery.data, access]);
  const filedProjectId = isFiledProjectForgotten ? undefined : filedLocationQuery.data?.projectId;
  const project = isRequired ? projects.find(candidate => candidate.id === (filedProjectId ?? projectId)) : undefined;
  const isLoading = isRequired && (projectsQuery.isLoading || access.isLoading || (isFiled && filedLocationQuery.isLoading));
  const isMissing = isRequired && !isLoading && !project;

  const chooseProject = useCallback((chosenProjectId: string) => {
    setProjectId(chosenProjectId);
    setNotice(undefined);
  }, []);
  const forgetProject = useCallback((reason?: string) => {
    setProjectId(null);
    setIsFiledProjectForgotten(true);
    setNotice(reason);
    setIsPickerDismissed(false);
  }, []);

  const target = useMemo<DeployTarget>(
    () => ({
      isRequired,
      isLoading,
      isMissing,
      organizationName,
      canCreateProject: canManageProjects,
      project,
      projects,
      chooseProject,
      forgetProject,
      notice,
      isFiled
    }),
    [isRequired, isLoading, isMissing, organizationName, canManageProjects, project, projects, chooseProject, forgetProject, notice, isFiled]
  );

  const isWaitingForAProject = !isFiled && !hasLetTheFlowThrough && (isOrganizationLoading || isLoading || isMissing);
  const isPicking = !isOrganizationLoading && isMissing && !isPickerDismissed;

  useEffect(
    function latchOnceTheFlowRuns() {
      if (!isWaitingForAProject) setHasLetTheFlowThrough(true);
    },
    [isWaitingForAProject]
  );

  const leavePicker = () => {
    if (hasLetTheFlowThrough) {
      setIsPickerDismissed(true);
      return;
    }
    router.push(UrlService.projects());
  };

  return (
    <DeployTargetContext.Provider value={target}>
      {isWaitingForAProject ? fallback : children}
      {isPicking && (
        <d.ChooseProjectModal
          organizationName={organizationName}
          projects={projects}
          canCreateProject={canManageProjects}
          notice={notice}
          onChosen={(chosen: Project) => chooseProject(chosen.id)}
          onCancel={leavePicker}
        />
      )}
    </DeployTargetContext.Provider>
  );
}
