"use client";
import type { FormEvent } from "react";
import { useId, useState } from "react";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  LoadingButton,
  Snackbar
} from "@akashnetwork/ui/components";
import { RefreshCw } from "lucide-react";
import { useSnackbar } from "notistack";

import { isProjectNameTakenError, useCreateProjectMutation } from "@src/queries/useProjectsQuery";
import type { Project } from "@src/types/project";
import { toProjectSlug } from "../ProjectNameField/ProjectNameField";
import { NEW_PROJECT_CHOICE, ProjectPicker } from "../ProjectPicker/ProjectPicker";

export const DEPENDENCIES = { useCreateProjectMutation, useSnackbar };

interface Props {
  organizationName: string;
  projects: Project[];
  /** The project already chosen, preselected when the picker reopens to change it. */
  initialProjectId?: string;
  /** Offers to create a project on the spot, which only owners and admins can. */
  canCreateProject: boolean;
  /** Why the picker asks, when it asks again after the api refused the project chosen before. */
  notice?: string;
  /** The projects could not be read, so the picker offers `onRetry` instead of claiming there are none. */
  isUnreadable?: boolean;
  onRetry?: () => void;
  onChosen: (project: Project) => void;
  onCancel: () => void;
  dependencies?: typeof DEPENDENCIES;
}

/** The step every new deployment passes when its organization uses projects: pick the project it belongs to, or create one on the spot. */
export function ChooseProjectModal({
  organizationName,
  projects,
  initialProjectId,
  canCreateProject,
  notice,
  isUnreadable = false,
  onRetry,
  onChosen,
  onCancel,
  dependencies: d = DEPENDENCIES
}: Props) {
  const formId = useId();
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutateAsync: createProject, isPending } = d.useCreateProjectMutation();
  const [choice, setChoice] = useState<string | null>(
    initialProjectId ?? (projects.length === 0 && canCreateProject && !isUnreadable ? NEW_PROJECT_CHOICE : null)
  );
  const [newProjectName, setNewProjectName] = useState("");
  const [refusedSlugs, setRefusedSlugs] = useState<string[]>([]);

  const newProjectSlug = toProjectSlug(newProjectName);
  const takenSlugs = [...projects.map(project => project.name.toLowerCase()), ...refusedSlugs];
  const isCreatingProject = choice === NEW_PROJECT_CHOICE;
  const chosenProject = projects.find(project => project.id === choice);
  const canContinue = isCreatingProject ? !!newProjectSlug && !takenSlugs.includes(newProjectSlug) : !!chosenProject;

  const createChosenProject = async () => {
    try {
      const { data: project } = await createProject({ data: { name: newProjectSlug } });
      enqueueSnackbar(<Snackbar title={`Created project ${project.name}`} iconVariant="success" />, { variant: "success" });
      onChosen(project);
    } catch (error) {
      if (isProjectNameTakenError(error)) {
        setRefusedSlugs(current => [...current, newProjectSlug]);
        return;
      }
      enqueueSnackbar(<Snackbar title="Couldn't create the project" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canContinue || isPending) return;

    if (chosenProject) {
      onChosen(chosenProject);
      return;
    }
    await createChosenProject();
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isPending ? onCancel() : undefined)}>
      <DialogV2Content className="max-w-[500px]" hideCloseButton={isPending}>
        <DialogV2Header>
          <DialogV2Title>Choose a project</DialogV2Title>
          <DialogV2Description>Every deployment in {organizationName} belongs to a project.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} onSubmit={submit} className="flex flex-col gap-3">
            {notice && (
              <p role="status" className="rounded-lg border border-border bg-muted px-3 py-2 text-[13px] text-foreground">
                {notice}
              </p>
            )}
            {isUnreadable ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-6 text-center">
                <p className="text-[13px] text-muted-foreground">Couldn&apos;t load your projects.</p>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : projects.length === 0 && !canCreateProject ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
                You don&apos;t have access to any project yet. Ask an owner or admin.
              </p>
            ) : (
              <ProjectPicker
                projects={projects}
                value={choice}
                onChange={setChoice}
                newProject={canCreateProject ? { name: newProjectName, onNameChange: setNewProjectName, takenSlugs } : undefined}
              />
            )}
          </form>
        </DialogV2Body>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} loading={isPending} disabled={!canContinue}>
            Continue
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
}
