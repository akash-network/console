"use client";
import type { FormEvent } from "react";
import { useId, useState } from "react";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  LoadingButton,
  Snackbar
} from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { isProjectNameTakenError, useUpdateProjectMutation } from "@src/queries/useProjectsQuery";
import type { Project } from "@src/types/project";
import { ProjectNameField, toProjectSlug } from "../ProjectNameField/ProjectNameField";

export const DEPENDENCIES = { useUpdateProjectMutation, useSnackbar };

interface Props {
  project: Pick<Project, "id" | "name">;
  /** Names of the organization's other projects, lowercased, refused before asking the api. */
  takenNames: string[];
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export function RenameProjectDialog({ project, takenNames, onClose, dependencies: d = DEPENDENCIES }: Props) {
  const formId = useId();
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutateAsync: updateProject, isPending } = d.useUpdateProjectMutation();
  const [name, setName] = useState(project.name);
  const [refusedNames, setRefusedNames] = useState<string[]>([]);

  const slug = toProjectSlug(name);
  const takenSlugs = [...takenNames.filter(taken => taken !== project.name.toLowerCase()), ...refusedNames];
  const canRename = !!slug && slug !== project.name && !takenSlugs.includes(slug);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRename || isPending) return;

    try {
      await updateProject({ id: project.id, data: { name: slug } });
      enqueueSnackbar(<Snackbar title={`Renamed ${project.name} to ${slug}`} iconVariant="success" />, { variant: "success" });
      onClose();
    } catch (error) {
      if (isProjectNameTakenError(error)) {
        setRefusedNames(current => [...current, slug]);
        return;
      }
      enqueueSnackbar(<Snackbar title="Couldn't rename the project" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
    }
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isPending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[460px]" hideCloseButton={isPending}>
        <DialogV2Header>
          <DialogV2Title>Rename {project.name}</DialogV2Title>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} onSubmit={submit}>
            <ProjectNameField value={name} onChange={setName} takenSlugs={takenSlugs} verb="renamed" autoFocus />
          </form>
        </DialogV2Body>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} loading={isPending} disabled={!canRename}>
            Rename
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
}
