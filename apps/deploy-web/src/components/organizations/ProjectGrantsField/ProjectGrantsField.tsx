"use client";
import { useId } from "react";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import { X } from "lucide-react";

import { PROJECT_ROLE_LABELS, PROJECT_ROLES } from "@src/components/projects/projectAccess";
import type { Project, ProjectRole } from "@src/types/project";

export interface ProjectGrant {
  projectId: string;
  role: ProjectRole;
}

const DEFAULT_GRANT_ROLE: ProjectRole = "member";

interface Props {
  projects: Pick<Project, "id" | "name">[];
  grants: ProjectGrant[];
  onChange: (grants: ProjectGrant[]) => void;
}

/** Picks the projects an invitee may open once they join, each project at most once and with its own role. */
export function ProjectGrantsField({ projects, grants, onChange }: Props) {
  const fieldId = useId();
  const grantedProjectIds = new Set(grants.map(grant => grant.projectId));
  const remainingProjects = projects.filter(project => !grantedProjectIds.has(project.id));
  const projectNames = new Map(projects.map(project => [project.id, project.name]));

  const addProject = (projectId: string) => onChange([...grants, { projectId, role: DEFAULT_GRANT_ROLE }]);
  const changeRole = (projectId: string, role: ProjectRole) => onChange(grants.map(grant => (grant.projectId === projectId ? { ...grant, role } : grant)));
  const removeProject = (projectId: string) => onChange(grants.filter(grant => grant.projectId !== projectId));

  return (
    <div className="flex flex-col gap-1.5">
      <Label id={fieldId}>
        Project access <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>

      {grants.length > 0 && (
        <ul aria-labelledby={fieldId} className="divide-y divide-border rounded-[10px] border border-border">
          {grants.map(grant => {
            const name = projectNames.get(grant.projectId) ?? grant.projectId;
            return (
              <li key={grant.projectId} className="flex items-center gap-2 py-1.5 pl-3.5 pr-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{name}</span>
                <Select value={grant.role} onValueChange={role => changeRole(grant.projectId, role as ProjectRole)}>
                  <SelectTrigger aria-label={`Role in ${name}`} className="h-8 w-[112px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_ROLES.map(role => (
                      <SelectItem key={role} value={role}>
                        {PROJECT_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  aria-label={`Remove ${name}`}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 rounded-md text-muted-foreground"
                  onClick={() => removeProject(grant.projectId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {remainingProjects.length > 0 && (
        <Select value="" onValueChange={addProject}>
          <SelectTrigger aria-label="Add a project" className="h-9">
            <SelectValue placeholder="Add a project" />
          </SelectTrigger>
          <SelectContent>
            {remainingProjects.map(project => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <p className="text-xs text-muted-foreground">Owners and admins open every project. Members and viewers open only the projects they are given.</p>
    </div>
  );
}
