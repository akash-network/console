"use client";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@akashnetwork/ui/components";
import { Check, ChevronsUpDown, LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";

import type { Project } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import { ProjectGlyph } from "../ProjectGlyph/ProjectGlyph";
import { sortProjectsNewestFirst } from "../projectSummary";

interface Props {
  organizationName: string;
  projects: Project[];
  currentProject: Project;
  /** Left out for a member who cannot create projects. */
  onNewProject?: () => void;
}

/** The project page title, which opens a menu to jump to another project of the organization, back to all of them, or to a new one. */
export function ProjectSwitcher({ organizationName, projects, currentProject, onNewProject }: Props) {
  const listedProjects = sortProjectsNewestFirst(projects);

  return (
    <DropdownMenu modal={false}>
      <h1>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="-ml-2 h-auto gap-2 rounded-lg px-2 py-1 text-xl font-bold leading-7 tracking-[-0.02em]">
            <span className="max-w-[60vw] truncate">{currentProject.name}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </h1>

      <DropdownMenuContent align="start" className="w-[284px] rounded-[11px]">
        <DropdownMenuLabel className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Projects in {organizationName}
        </DropdownMenuLabel>

        <div className="max-h-72 overflow-y-auto">
          {listedProjects.map(project => (
            <DropdownMenuItem key={project.id} asChild className="group gap-2.5 rounded-[7px]">
              <Link href={UrlService.project(project.id)} aria-current={project.id === currentProject.id ? "page" : undefined}>
                <ProjectGlyph name={project.name} size={20} />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {project.deploymentSummary?.activeCount !== undefined && (
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{project.deploymentSummary.activeCount} active</span>
                )}
                <Check className="h-4 w-4 shrink-0 opacity-0 group-aria-[current=page]:opacity-100" aria-hidden="true" />
              </Link>
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="gap-2.5 rounded-[7px]">
          <Link href={UrlService.projects()}>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            All projects
          </Link>
        </DropdownMenuItem>
        {onNewProject && (
          <DropdownMenuItem className="gap-2.5 rounded-[7px]" onSelect={onNewProject}>
            <Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            New project
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
