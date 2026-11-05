import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Project } from "@src/types/project";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./MoveDeploymentCard";
import { MoveDeploymentCard } from "./MoveDeploymentCard";

import { act, render } from "@testing-library/react";

const DEFAULT_PROJECT = mock<Project>({ id: "p-default", name: "Default" });
const RESEARCH_PROJECT = mock<Project>({ id: "p-research", name: "Research" });

describe(MoveDeploymentCard.name, () => {
  it("shows where the deployment is and the project the assistant suggests", () => {
    const { chromeProps, decision } = setup({});

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Move the deployment",
        scope: "dseq 42",
        tier: "confirm",
        decision,
        rows: [
          { label: "From", value: "Default" },
          { label: "To", value: "Research" }
        ],
        confirmLabel: "Move",
        successMessage: "Moved to Research.",
        isConfirmDisabled: false
      })
    );
  });

  it("lists the projects to pick from with the suggested one picked and the current one unavailable", () => {
    const { ProjectPicker } = setup({});
    const pickerProps = ProjectPicker.mock.lastCall![0];

    expect(pickerProps.projects.map(({ id }) => id)).toEqual(["p-default", "p-research"]);
    expect(pickerProps).toMatchObject({ value: "p-research", unavailableProjectId: "p-default" });
  });

  it("moves to the project the user picks instead", async () => {
    const { chromeProps, ProjectPicker, updateDeploymentProject } = setup({ projectId: "p-unknown" });
    expect(chromeProps().isConfirmDisabled).toBe(true);
    expect(chromeProps().rows).toContainEqual({ label: "To", value: "Pick a project" });

    act(() => ProjectPicker.mock.lastCall![0].onChange("p-research"));
    await chromeProps().onConfirm!("");

    expect(updateDeploymentProject).toHaveBeenCalledWith({ dseq: "42", data: { projectId: "p-research" } });
  });

  it("does not move a deployment to the project it is already in", () => {
    const { chromeProps } = setup({ projectId: "p-default" });

    expect(chromeProps().isConfirmDisabled).toBe(true);
  });

  it("says a deployment filed nowhere comes from no project", () => {
    const { chromeProps } = setup({ currentProjectId: null });

    expect(chromeProps().rows).toContainEqual({ label: "From", value: "No project" });
  });

  it("explains a refusal the way the move dialog does", async () => {
    const { chromeProps, updateDeploymentProject } = setup({});
    updateDeploymentProject.mockRejectedValue(new ApiError(403, { message: "Forbidden" }, "forbidden"));

    await expect(chromeProps().onConfirm!("")).rejects.toThrow("Only owners and admins can move deployments between projects.");
  });

  it("hides the picker once the move is done", () => {
    const { ProjectPicker } = setup({ status: "succeeded" });

    expect(ProjectPicker).not.toHaveBeenCalled();
  });

  function setup(input: { projectId?: string; currentProjectId?: string | null; status?: ActionCardDecision["status"] }) {
    const updateDeploymentProject = vi.fn(async (_input: unknown): Promise<unknown> => ({}));
    const ActionCardChrome = vi.fn((props: ActionCardChromeProps) => <>{props.children}</>);
    const ProjectPicker = vi.fn((_props: Parameters<typeof DEPENDENCIES.ProjectPicker>[0]) => null);
    const decision = mock<ActionCardDecision>({ status: input.status ?? "pending" });
    const currentProjectId = input.currentProjectId === undefined ? "p-default" : input.currentProjectId;
    const projects = [DEFAULT_PROJECT, RESEARCH_PROJECT];

    render(
      <MoveDeploymentCard
        action={{ type: "move_deployment", tier: "confirm", dseq: "42", projectId: input.projectId ?? "p-research" }}
        decision={decision}
        dependencies={{
          useProjectsQuery: () => mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: projects }),
          useDeploymentLocationQuery: () =>
            mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocationQuery>>({
              data: { organizationId: "o", organizationSlug: "acme", projectId: currentProjectId }
            }),
          useUpdateDeploymentProjectMutation: () =>
            mock<ReturnType<typeof DEPENDENCIES.useUpdateDeploymentProjectMutation>>({
              mutateAsync: updateDeploymentProject as ReturnType<typeof DEPENDENCIES.useUpdateDeploymentProjectMutation>["mutateAsync"]
            }),
          ProjectPicker: ProjectPicker as unknown as typeof DEPENDENCIES.ProjectPicker,
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], ProjectPicker, updateDeploymentProject, decision };
  }
});
