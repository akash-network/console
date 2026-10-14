"use client";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { useRouter } from "next/navigation";

import type { DeployTarget } from "@src/hooks/useDeployTarget/useDeployTarget";
import type { Project } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import { ChooseProjectModal } from "../ChooseProjectModal/ChooseProjectModal";
import { ProjectGlyph } from "../ProjectGlyph/ProjectGlyph";

export const DEPENDENCIES = { useRouter, ChooseProjectModal };

interface Props {
  target: DeployTarget;
  onChoose: (projectId: string) => void;
  dependencies?: typeof DEPENDENCIES;
}

/** "Deploying to {organization} / {project}" with a Change button; with no project it opens the picker, whose cancel leaves for Projects. */
export function DeployTargetChip({ target, onChoose, dependencies: d = DEPENDENCIES }: Props) {
  const router = d.useRouter();
  const [isChanging, setIsChanging] = useState(false);

  if (!target.isRequired || target.isLoading) return null;

  const choose = (project: Project) => {
    setIsChanging(false);
    onChoose(project.id);
  };
  const cancel = () => (target.project ? setIsChanging(false) : router.push(UrlService.projects()));

  return (
    <>
      {target.project && (
        <div className="mt-3 inline-flex min-h-[34px] max-w-full flex-wrap items-center gap-2 rounded-[10px] border border-border bg-card py-1 pl-3 pr-1 text-[13px]">
          <span className="text-muted-foreground">Deploying to</span>
          <span className="inline-flex items-center gap-1.5">
            <ProjectGlyph name={target.organizationName} size={18} />
            {target.organizationName}
          </span>
          <span className="text-muted-foreground" aria-hidden="true">
            /
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold">
            <ProjectGlyph name={target.project.name} size={18} />
            <span className="truncate">{target.project.name}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-[26px] rounded-md bg-muted px-2.5 text-xs font-semibold"
            aria-label="Change project"
            onClick={() => setIsChanging(true)}
          >
            Change
          </Button>
        </div>
      )}

      {(isChanging || target.isMissing) && (
        <d.ChooseProjectModal
          organizationName={target.organizationName}
          projects={target.projects}
          initialProjectId={target.project?.id}
          canCreateProject={target.canCreateProject}
          notice={target.notice}
          isUnreadable={target.isUnreadable}
          onRetry={target.retry}
          onChosen={choose}
          onCancel={cancel}
        />
      )}
    </>
  );
}
