"use client";
import Link from "next/link";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import { UrlService } from "@src/utils/urlUtils";
import { budgetAccessFor } from "../projectSpend";

export const DEPENDENCIES = { useActiveOrganization, useProjectsQuery };

interface Props {
  /** The project whose budget refused the deployment, when known. */
  projectId?: string;
  onNavigate?: () => void;
  dependencies?: typeof DEPENDENCIES;
}

/** Why a deployment was not started when its project is at its monthly budget, with the way to the budget for those who can change it. */
export function ProjectBudgetRefusal({ projectId, onNavigate, dependencies: d = DEPENDENCIES }: Props) {
  const { activeOrganization, projectsEnabled } = d.useActiveOrganization();
  const { data: projects } = d.useProjectsQuery({ enabled: !!projectId });
  const projectName = projects?.find(project => project.id === projectId)?.name;
  const { canManage } = budgetAccessFor(activeOrganization?.role, undefined);

  return (
    <span className="flex flex-col gap-1">
      <span>
        Starting this deployment would take {projectName ? <strong>{projectName}</strong> : "the project"} past its monthly budget, so it wasn&apos;t started.
      </span>
      {canManage && projectsEnabled && projectId ? (
        <Link href={UrlService.project(projectId)} className="font-medium text-foreground underline" onClick={onNavigate}>
          Review the project&apos;s budget
        </Link>
      ) : (
        <span>An owner or admin can raise the budget.</span>
      )}
    </span>
  );
}
