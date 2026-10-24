"use client";
import Link from "next/link";

import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import type { OrganizationRole } from "@src/types/organization";
import { UrlService } from "@src/utils/urlUtils";
import { budgetAccessFor } from "../projectSpend";

export const DEPENDENCIES = { useProjectsQuery };

interface Props {
  /** The project whose budget refused the deployment, when known. */
  projectId?: string;
  /** Given by the caller, since a toast renders outside the organization provider and cannot read it. */
  organizationRole: OrganizationRole | undefined;
  projectsEnabled: boolean;
  onNavigate?: () => void;
  dependencies?: typeof DEPENDENCIES;
}

/** Why a deployment was not started when its project is at its monthly budget, with the way to the budget for those who can change it. */
export function ProjectBudgetRefusal({ projectId, organizationRole, projectsEnabled, onNavigate, dependencies: d = DEPENDENCIES }: Props) {
  const { data: projects } = d.useProjectsQuery({ enabled: !!projectId });
  const projectName = projects?.find(project => project.id === projectId)?.name;
  const { canManage } = budgetAccessFor(organizationRole, undefined);

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
