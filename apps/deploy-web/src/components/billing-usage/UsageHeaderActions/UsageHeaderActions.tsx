"use client";
import React, { type FC } from "react";
import { Button, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import { Calendar, Download, Layers } from "lucide-react";

import type { ProjectScopeControl } from "@src/components/billing-usage/UsageContainer/UsageContainer";
import { USAGE_DATE_PRESETS, type UsageDatePreset } from "@src/components/billing-usage/UsageContainer/usageDatePresets";

/** Radix Select needs a string for every item, so the whole organization gets one that no project id can take. */
const ALL_PROJECTS = "all-projects";

export type UsageHeaderActionsProps = {
  datePreset: UsageDatePreset;
  onDatePresetChange: (preset: UsageDatePreset) => void;
  onExport: () => void;
  isExportDisabled: boolean;
  projectScope?: ProjectScopeControl | null;
};

export const UsageHeaderActions: FC<UsageHeaderActionsProps> = ({ datePreset, onDatePresetChange, onExport, isExportDisabled, projectScope }) => (
  <div className="flex flex-wrap items-center gap-2">
    {projectScope && <ProjectScopeSelect {...projectScope} />}
    <Select value={datePreset} onValueChange={value => onDatePresetChange(value as UsageDatePreset)}>
      <SelectTrigger aria-label="Date range" className="h-9 w-auto gap-2 text-[13px] font-medium">
        <Calendar className="h-[15px] w-[15px] text-muted-foreground" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {USAGE_DATE_PRESETS.map(preset => (
          <SelectItem key={preset.value} value={preset.value}>
            {preset.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[13px]" onClick={onExport} disabled={isExportDisabled}>
      <Download className="h-[15px] w-[15px]" aria-hidden />
      Export CSV
    </Button>
  </div>
);

const ProjectScopeSelect: FC<ProjectScopeControl> = ({ projects, selected, onChange }) => (
  <Select value={selected ?? ALL_PROJECTS} onValueChange={value => onChange(value === ALL_PROJECTS ? null : value)}>
    <SelectTrigger aria-label="Projects" className="h-9 w-[200px] gap-2 text-[13px] font-medium">
      <Layers className="h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden />
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
      {projects.length > 0 && (
        <>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Projects</SelectLabel>
            {projects.map(project => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </>
      )}
    </SelectContent>
  </Select>
);
