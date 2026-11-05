"use client";
import type { FC } from "react";
import { useState } from "react";

import { describeMoveRefusal } from "@src/components/projects/MoveDeploymentDialog/MoveDeploymentDialog";
import { ProjectPicker } from "@src/components/projects/ProjectPicker/ProjectPicker";
import { useDeploymentLocationQuery, useUpdateDeploymentProjectMutation } from "@src/queries/useDeploymentProjectQueries";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";

export const DEPENDENCIES = { useProjectsQuery, useDeploymentLocationQuery, useUpdateDeploymentProjectMutation, ProjectPicker, ActionCardChrome };

const UNFILED_LABEL = "No project";

export const MoveDeploymentCard: FC<ActionCardProps<"move_deployment"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { data: projects = [] } = d.useProjectsQuery();
  const { data: location } = d.useDeploymentLocationQuery(action.dseq);
  const { mutateAsync: updateDeploymentProject } = d.useUpdateDeploymentProjectMutation();
  const [projectId, setProjectId] = useState(action.projectId);

  const currentProjectId = location?.projectId ?? undefined;
  const currentProject = projects.find(project => project.id === currentProjectId);
  const targetProject = projects.find(project => project.id === projectId);
  const isAlreadyThere = !!targetProject && targetProject.id === currentProjectId;

  const move = async () => {
    try {
      await updateDeploymentProject({ dseq: action.dseq, data: { projectId } });
    } catch (error) {
      throw new Error(describeMoveRefusal(error), { cause: error });
    }
  };

  return (
    <d.ActionCardChrome
      title="Move the deployment"
      scope={`dseq ${action.dseq}`}
      tier={action.tier}
      decision={decision}
      rows={[
        { label: "From", value: currentProject?.name ?? UNFILED_LABEL },
        { label: "To", value: targetProject?.name ?? "Pick a project" }
      ]}
      costNote="The deployment keeps running while it moves. Only owners and admins can move deployments between projects."
      confirmLabel="Move"
      successMessage={`Moved to ${targetProject?.name}.`}
      isConfirmDisabled={!targetProject || isAlreadyThere}
      onConfirm={move}
    >
      {decision.status !== "succeeded" && (
        <d.ProjectPicker projects={projects} value={projectId} onChange={setProjectId} unavailableProjectId={currentProjectId} />
      )}
    </d.ActionCardChrome>
  );
};
