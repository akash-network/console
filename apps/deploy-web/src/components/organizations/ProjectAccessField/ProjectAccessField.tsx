"use client";
import { useId } from "react";
import { Label, RadioGroup } from "@akashnetwork/ui/components";

import type { ProjectGrant } from "@src/components/organizations/ProjectGrantsField/ProjectGrantsField";
import { ProjectGrantsField } from "@src/components/organizations/ProjectGrantsField/ProjectGrantsField";
import { RadioCard } from "@src/components/organizations/RadioCard/RadioCard";
import type { ProjectAccess } from "@src/types/organizationMembership";
import type { Project } from "@src/types/project";

export const DEPENDENCIES = { ProjectGrantsField };

export interface ProjectAccessValue {
  access: ProjectAccess;
  grants: ProjectGrant[];
}

export const NO_PROJECT_PICKED_MESSAGE = "Pick at least one project.";

export function hasProjectAccess({ access, grants }: ProjectAccessValue): boolean {
  return access === "all" || grants.length > 0;
}

/** Grants count only on specific projects, and in no particular order. */
export function isSameProjectAccess(value: ProjectAccessValue, other: ProjectAccessValue): boolean {
  if (value.access !== other.access) return false;
  if (value.access === "all") return true;

  return (
    value.grants.length === other.grants.length &&
    value.grants.every(grant => other.grants.some(otherGrant => otherGrant.projectId === grant.projectId && otherGrant.role === grant.role))
  );
}

export function toProjectAccessRequest({ access, grants }: ProjectAccessValue): { projectAccess: ProjectAccess; projectGrants?: ProjectGrant[] } {
  return access === "all" ? { projectAccess: access } : { projectAccess: access, projectGrants: grants };
}

interface Props {
  organizationName: string;
  projects: Pick<Project, "id" | "name">[];
  value: ProjectAccessValue;
  onChange: (value: ProjectAccessValue) => void;
  dependencies?: typeof DEPENDENCIES;
}

export function ProjectAccessField({ organizationName, projects, value, onChange, dependencies: d = DEPENDENCIES }: Props) {
  const fieldId = useId();
  const options: { access: ProjectAccess; label: string; description: string }[] = [
    { access: "all", label: "All projects", description: `Every project in ${organizationName}, including new ones.` },
    { access: "selected", label: "Specific projects", description: "Only the projects you pick, each with its own role." }
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <Label id={`${fieldId}-label`}>Project access</Label>
      <RadioGroup
        aria-labelledby={`${fieldId}-label`}
        value={value.access}
        onValueChange={access => onChange({ ...value, access: access as ProjectAccess })}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {options.map(option => (
          <RadioCard key={option.access} id={`${fieldId}-${option.access}`} value={option.access} label={option.label} description={option.description} />
        ))}
      </RadioGroup>

      {value.access === "selected" && (
        <>
          <d.ProjectGrantsField projects={projects} grants={value.grants} onChange={grants => onChange({ ...value, grants })} />
          {value.grants.length === 0 && <p className="text-xs text-muted-foreground">{NO_PROJECT_PICKED_MESSAGE}</p>}
        </>
      )}
    </div>
  );
}
