import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeployTarget } from "@src/hooks/useDeployTarget/useDeployTarget";
import type { Project } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./DeployTargetChip";
import { DeployTargetChip } from "./DeployTargetChip";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(DeployTargetChip.name, () => {
  it("shows the organization and project the deployment goes to", () => {
    setup({ project: storefront });

    expect(screen.getByText("Deploying to")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("storefront")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows nothing while projects are off", () => {
    setup({ isRequired: false, project: storefront });

    expect(screen.queryByText("Deploying to")).not.toBeInTheDocument();
  });

  it("shows nothing while the projects load", () => {
    setup({ isLoading: true, isMissing: true });

    expect(screen.queryByText("Deploying to")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks for a project right away while none is chosen", () => {
    const { ChooseProjectModal } = setup({ isMissing: true });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(ChooseProjectModal.mock.lastCall?.[0]).toMatchObject({
      organizationName: "Acme Corp",
      projects: [storefront],
      initialProjectId: undefined,
      canCreateProject: false,
      notice: "Choose another one."
    });
  });

  it("hands the picker a failed read of the projects and the way to retry it", () => {
    const { ChooseProjectModal, retry } = setup({ isMissing: true, isUnreadable: true });

    expect(ChooseProjectModal.mock.lastCall?.[0]).toMatchObject({ isUnreadable: true, onRetry: retry });
  });

  it("abandons the new deployment for the projects page when the first choice is cancelled", async () => {
    const { push } = setup({ isMissing: true });

    await userEvent.click(screen.getByRole("button", { name: "cancel" }));

    expect(push).toHaveBeenCalledWith(UrlService.projects());
  });

  it("reopens the picker on the chosen project to change it", async () => {
    const { ChooseProjectModal } = setup({ project: storefront });

    await userEvent.click(screen.getByRole("button", { name: "Change project" }));

    expect(ChooseProjectModal.mock.lastCall?.[0]).toMatchObject({ initialProjectId: "storefront" });
  });

  it("keeps the chosen project when a change is cancelled", async () => {
    const { push } = setup({ project: storefront });

    await userEvent.click(screen.getByRole("button", { name: "Change project" }));
    await userEvent.click(screen.getByRole("button", { name: "cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("hands over the project chosen and closes the picker", async () => {
    const { onChoose } = setup({ project: storefront });

    await userEvent.click(screen.getByRole("button", { name: "Change project" }));
    await userEvent.click(screen.getByRole("button", { name: "choose" }));

    expect(onChoose).toHaveBeenCalledWith("marketing");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  function setup(input: { isRequired?: boolean; isLoading?: boolean; isMissing?: boolean; isUnreadable?: boolean; project?: Project }) {
    const push = vi.fn();
    const retry = vi.fn();
    const onChoose = vi.fn();
    const ChooseProjectModal = vi.fn<typeof DEPENDENCIES.ChooseProjectModal>(({ onChosen, onCancel }) => (
      <div role="dialog">
        <button type="button" onClick={() => onChosen(mock<Project>({ id: "marketing" }))}>
          choose
        </button>
        <button type="button" onClick={onCancel}>
          cancel
        </button>
      </div>
    ));
    const target: DeployTarget = {
      isRequired: input.isRequired ?? true,
      isLoading: input.isLoading ?? false,
      isMissing: input.isMissing ?? false,
      organizationName: "Acme Corp",
      canCreateProject: false,
      notice: "Choose another one.",
      project: input.project,
      projects: [storefront],
      chooseProject: vi.fn(),
      forgetProject: vi.fn(),
      isUnreadable: input.isUnreadable ?? false,
      retry
    };
    const dependencies: typeof DEPENDENCIES = {
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push }),
      ChooseProjectModal
    };

    render(<DeployTargetChip target={target} onChoose={onChoose} dependencies={dependencies} />);

    return { push, onChoose, ChooseProjectModal, retry };
  }
});

const storefront: Project = {
  id: "storefront",
  name: "storefront",
  slug: "storefront",
  description: null,
  isDefault: false,
  createdAt: "2026-01-01T12:00:00.000Z",
  createdBy: null
};
