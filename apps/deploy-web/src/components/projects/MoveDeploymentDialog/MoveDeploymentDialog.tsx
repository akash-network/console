"use client";
import type { FormEvent } from "react";
import { useId, useState } from "react";
import { isApiError } from "@akashnetwork/openapi-sdk";
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
import { useSnackbar } from "notistack";

import { useUpdateDeploymentProjectMutation } from "@src/queries/useDeploymentProjectQueries";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import { ProjectPicker } from "../ProjectPicker/ProjectPicker";

export const DEPENDENCIES = { useProjectsQuery, useUpdateDeploymentProjectMutation, useSnackbar };

const NOT_FOUND_STATUS = 404;

const FORBIDDEN_STATUS = 403;

interface Props {
  deployment: { dseq: string; name?: string | null; projectId: string };
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
}

/** Files a deployment under another project of its organization; the deployment itself keeps running untouched. */
export function MoveDeploymentDialog({ deployment, onClose, dependencies: d = DEPENDENCIES }: Props) {
  const formId = useId();
  const { enqueueSnackbar } = d.useSnackbar();
  const { data: projects = [], refetch: refetchProjects } = d.useProjectsQuery();
  const { mutateAsync: updateDeploymentProject, isPending } = d.useUpdateDeploymentProjectMutation();
  const [projectId, setProjectId] = useState<string | null>(null);

  const deploymentName = deployment.name || `Deployment #${deployment.dseq}`;
  const chosenProject = projects.find(project => project.id === projectId && project.id !== deployment.projectId);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chosenProject || isPending) return;

    try {
      await updateDeploymentProject({ dseq: deployment.dseq, data: { projectId: chosenProject.id } });
      enqueueSnackbar(<Snackbar title={`Moved ${deploymentName} to ${chosenProject.name}`} iconVariant="success" />, { variant: "success" });
      onClose();
    } catch (error) {
      if (isApiError(error) && error.status === NOT_FOUND_STATUS) void refetchProjects();
      enqueueSnackbar(<Snackbar title="Couldn't move the deployment" subTitle={describeMoveRefusal(error)} iconVariant="error" />, { variant: "error" });
    }
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isPending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[500px]" hideCloseButton={isPending}>
        <DialogV2Header>
          <DialogV2Title>Move to project</DialogV2Title>
          <DialogV2Description>Choose the project {deploymentName} belongs to. It keeps running while it moves.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} onSubmit={submit}>
            <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} unavailableProjectId={deployment.projectId} />
          </form>
        </DialogV2Body>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} loading={isPending} disabled={!chosenProject}>
            Move
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
}

function describeMoveRefusal(error: unknown): string {
  if (!isApiError(error)) return "Try again in a moment.";
  if (error.status === NOT_FOUND_STATUS) return "That project or deployment no longer exists here. The list of projects was refreshed.";
  if (error.status === FORBIDDEN_STATUS) return "Only owners and admins can move deployments between projects.";
  return "Try again in a moment.";
}
