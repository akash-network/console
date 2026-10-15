"use client";
import { RadioGroup, RadioGroupItem } from "@akashnetwork/ui/components";
import { Plus } from "lucide-react";

import type { Project } from "@src/types/project";
import { ProjectGlyph } from "../ProjectGlyph/ProjectGlyph";
import { ProjectNameField } from "../ProjectNameField/ProjectNameField";

/** The picker value of the "Create a new project" row; project ids are uuids, so it never collides with one. */
export const NEW_PROJECT_CHOICE = "new-project";

const ROW_LAYOUT = "flex min-h-[52px] cursor-pointer items-center gap-3 px-3.5 py-2.5";

const PROJECT_ROW_CLASSES = `${ROW_LAYOUT} border-b border-border last:border-b-0 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60`;

interface Props {
  projects: Project[];
  value: string | null;
  onChange: (value: string) => void;
  /** Adds the "Create a new project" row, which reveals the name field once picked. */
  newProject?: { name: string; onNameChange: (name: string) => void; takenSlugs: string[] };
  /** A project shown but not pickable, such as the one a deployment is already filed under. */
  unavailableProjectId?: string;
}

/** The projects of an organization as a radio list, each with its glyph and how many deployments it runs. */
export function ProjectPicker({ projects, value, onChange, newProject, unavailableProjectId }: Props) {
  return (
    <RadioGroup value={value ?? ""} onValueChange={onChange} aria-label="Projects" className="gap-0 overflow-hidden rounded-xl border border-border">
      {projects.map(project => (
        <label key={project.id} className={PROJECT_ROW_CLASSES}>
          <RadioGroupItem value={project.id} aria-label={project.name} disabled={project.id === unavailableProjectId} />
          <ProjectGlyph name={project.name} size={26} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{project.name}</span>
          {project.deployments && <span className="whitespace-nowrap text-[12.5px] text-muted-foreground">{project.deployments.activeCount} active</span>}
        </label>
      ))}

      {newProject && (
        <div>
          <label className={ROW_LAYOUT}>
            <RadioGroupItem value={NEW_PROJECT_CHOICE} aria-label="Create a new project" />
            <span
              aria-hidden="true"
              className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border border-dashed border-muted-foreground/60 text-muted-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold">Create a new project</span>
          </label>

          {value === NEW_PROJECT_CHOICE && (
            <div className="pb-3.5 pl-[42px] pr-3.5">
              <ProjectNameField value={newProject.name} onChange={newProject.onNameChange} takenSlugs={newProject.takenSlugs} autoFocus />
            </div>
          )}
        </div>
      )}
    </RadioGroup>
  );
}
