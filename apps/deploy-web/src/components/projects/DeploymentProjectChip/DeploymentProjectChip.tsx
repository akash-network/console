"use client";
import Link from "next/link";

import { useProjectsUi } from "@src/hooks/useProjectsUi/useProjectsUi";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import { UrlService } from "@src/utils/urlUtils";
import { ProjectGlyph } from "../ProjectGlyph/ProjectGlyph";
import { useProjectScope } from "../ProjectScope/ProjectScope";

export const DEPENDENCIES = { useProjectsUi, useProjectsQuery, useProjectScope };

interface Props {
  projectId: string | undefined;
  dependencies?: typeof DEPENDENCIES;
}

/** The project a deployment is filed under, linking to it; left out on that project's own page, where it would only repeat the title. */
export function DeploymentProjectChip({ projectId, dependencies: d = DEPENDENCIES }: Props) {
  const { isEnabled } = d.useProjectsUi();
  const { data: projects } = d.useProjectsQuery({ enabled: isEnabled });
  const scopedProjectId = d.useProjectScope();
  const project = projects?.find(candidate => candidate.id === projectId);

  if (!isEnabled || !project || project.id === scopedProjectId) return null;

  return (
    <Link
      href={UrlService.project(project.id)}
      aria-label={`Project ${project.name}`}
      className="mt-1 inline-flex w-fit max-w-full items-center gap-1.5 rounded-md border border-border bg-card py-0.5 pl-0.5 pr-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ProjectGlyph name={project.name} size={16} />
      <span className="truncate">{project.name}</span>
    </Link>
  );
}
