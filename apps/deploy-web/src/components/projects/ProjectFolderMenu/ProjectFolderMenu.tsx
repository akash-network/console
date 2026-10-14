"use client";
import { useState } from "react";
import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Snackbar } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useSnackbar } from "notistack";

import { useDeleteProjectMutation } from "@src/queries/useProjectsQuery";
import type { Project } from "@src/types/project";
import { PROJECT_IS_DEFAULT_ERROR_CODE, PROJECT_NOT_EMPTY_ERROR_CODE } from "@src/types/project";
import { RenameProjectDialog } from "../RenameProjectDialog/RenameProjectDialog";

export const DEPENDENCIES = { usePopup, useSnackbar, useDeleteProjectMutation, RenameProjectDialog };

interface Props {
  project: Pick<Project, "id" | "name" | "isDefault">;
  /** Names of every project of the organization, lowercased, which a rename must not reuse. */
  takenNames: string[];
  dependencies?: typeof DEPENDENCIES;
}

/** The owner and admin actions on a project folder: rename it, or delete it once it holds no open deployment. */
export function ProjectFolderMenu({ project, takenNames, dependencies: d = DEPENDENCIES }: Props) {
  const { confirm } = d.usePopup();
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutateAsync: deleteProject } = d.useDeleteProjectMutation();
  const [isRenaming, setIsRenaming] = useState(false);

  const confirmAndDelete = async () => {
    const isConfirmed = await confirm({
      title: `Delete ${project.name}?`,
      message: "The project is removed from the organization. Only a project without open deployments can be deleted."
    });
    if (!isConfirmed) return;

    try {
      await deleteProject({ id: project.id });
      enqueueSnackbar(<Snackbar title={`Deleted project ${project.name}`} iconVariant="success" />, { variant: "success" });
    } catch (error) {
      enqueueSnackbar(<Snackbar title="Couldn't delete the project" subTitle={describeDeleteRefusal(error)} iconVariant="error" />, { variant: "error" });
    }
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button aria-label={`Actions for project ${project.name}`} size="icon" variant="ghost" className="-mr-2 -mt-1 h-7 w-7 shrink-0 rounded-full">
            <Ellipsis className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setIsRenaming(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          {!project.isDefault && (
            <DropdownMenuItem onSelect={confirmAndDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {isRenaming && <d.RenameProjectDialog project={project} takenNames={takenNames} onClose={() => setIsRenaming(false)} />}
    </>
  );
}

function describeDeleteRefusal(error: unknown): string {
  const code = extractApiErrorCode(error);
  if (code === PROJECT_NOT_EMPTY_ERROR_CODE) return "It still holds open deployments. Close them or move them to another project first.";
  if (code === PROJECT_IS_DEFAULT_ERROR_CODE) return "The default project can't be deleted.";
  return "Try again in a moment.";
}
