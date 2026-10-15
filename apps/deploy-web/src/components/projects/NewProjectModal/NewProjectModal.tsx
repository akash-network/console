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
  Label,
  LoadingButton,
  Snackbar,
  Textarea
} from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { isProjectNameTakenError, useCreateProjectMutation } from "@src/queries/useProjectsQuery";
import type { Project } from "@src/types/project";
import { MAX_PROJECT_DESCRIPTION_LENGTH } from "@src/types/project";
import { describeProjectCreationFailure } from "../projectCreationFailure";
import { ProjectNameField, toProjectSlug } from "../ProjectNameField/ProjectNameField";

export const DEPENDENCIES = { useCreateProjectMutation, useSnackbar };

interface Props {
  organizationName: string;
  /** Slugs of the projects the organization already has, refused before asking the api. */
  existingSlugs: string[];
  onClose: () => void;
  onCreated: (project: Project) => void;
  dependencies?: typeof DEPENDENCIES;
}

export function NewProjectModal({ organizationName, existingSlugs, onClose, onCreated, dependencies: d = DEPENDENCIES }: Props) {
  const formId = useId();
  const descriptionId = useId();
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutateAsync: createProject, isPending } = d.useCreateProjectMutation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [refusedSlugs, setRefusedSlugs] = useState<string[]>([]);

  const slug = toProjectSlug(name);
  const takenSlugs = [...existingSlugs, ...refusedSlugs];
  const canCreate = !!slug && !takenSlugs.includes(slug);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || isPending) return;

    const trimmedDescription = description.trim();
    try {
      const { data: project } = await createProject({ data: { name: slug, ...(trimmedDescription ? { description: trimmedDescription } : {}) } });
      enqueueSnackbar(<Snackbar title={`Created project ${project.name}`} iconVariant="success" />, { variant: "success" });
      onCreated(project);
    } catch (error) {
      if (isProjectNameTakenError(error)) {
        setRefusedSlugs(current => [...current, slug]);
        return;
      }
      enqueueSnackbar(<Snackbar title="Couldn't create the project" subTitle={describeProjectCreationFailure(error)} iconVariant="error" />, {
        variant: "error"
      });
    }
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isPending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[460px]" hideCloseButton={isPending}>
        <DialogV2Header>
          <DialogV2Title>New project</DialogV2Title>
          <DialogV2Description>A project groups the deployments behind one app or service in {organizationName}.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} className="flex flex-col gap-4" onSubmit={submit}>
            <ProjectNameField value={name} onChange={setName} takenSlugs={takenSlugs} autoFocus />

            <div className="space-y-1.5">
              <Label htmlFor={descriptionId} className="text-[13px]">
                Description <span className="ml-1 font-normal text-muted-foreground">Optional</span>
              </Label>
              <Textarea
                id={descriptionId}
                value={description}
                rows={2}
                maxLength={MAX_PROJECT_DESCRIPTION_LENGTH}
                placeholder="What lives in this project?"
                inputClassName="min-h-16 resize-y"
                onChange={event => setDescription(event.target.value)}
              />
            </div>
          </form>
        </DialogV2Body>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} loading={isPending} disabled={!canCreate}>
            Create project
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
}
