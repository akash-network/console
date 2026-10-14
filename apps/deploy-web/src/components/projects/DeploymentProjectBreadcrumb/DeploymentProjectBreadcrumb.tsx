"use client";
import Link from "next/link";

import { useProjectsUi } from "@src/hooks/useProjectsUi/useProjectsUi";
import { useDeploymentLocationQuery } from "@src/queries/useDeploymentProjectQueries";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useProjectsUi, useDeploymentLocationQuery, useProjectsQuery };

const CRUMB_LINK_CLASSES = "text-muted-foreground transition-colors hover:text-foreground";

interface Props {
  dseq: string;
  dependencies?: typeof DEPENDENCIES;
}

/** "Projects / {project}" above a deployment's name, leading back to the project it is filed under. */
export function DeploymentProjectBreadcrumb({ dseq, dependencies: d = DEPENDENCIES }: Props) {
  const { isEnabled } = d.useProjectsUi();
  const { data: location } = d.useDeploymentLocationQuery(dseq, { enabled: isEnabled });
  const { data: projects } = d.useProjectsQuery({ enabled: isEnabled });
  const project = projects?.find(candidate => candidate.id === location?.projectId);

  if (!isEnabled || !project) return null;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
        <li>
          <Link href={UrlService.projects()} className={CRUMB_LINK_CLASSES}>
            Projects
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="min-w-0 truncate">
          <Link href={UrlService.project(project.id)} className={CRUMB_LINK_CLASSES} aria-current="page">
            {project.name}
          </Link>
        </li>
      </ol>
    </nav>
  );
}
