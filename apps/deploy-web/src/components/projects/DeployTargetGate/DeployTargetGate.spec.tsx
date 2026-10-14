import type { ReactNode } from "react";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { deployTargetProjectIdAtom } from "@src/store/deployTargetStore";
import type { DeploymentLocation, Project } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./DeployTargetGate";
import { DeployTargetGate, useConfigureDeployTarget } from "./DeployTargetGate";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(DeployTargetGate.name, () => {
  it("lets the flow through with the project the page before handed over, and takes it over", () => {
    const { store, flowTarget } = setup({ handedOverProjectId: "storefront" });

    expect(screen.getByText("flow")).toBeInTheDocument();
    expect(flowTarget().project?.id).toBe("storefront");
    expect(store.get(deployTargetProjectIdAtom)).toBeNull();
  });

  it("offers the picker a retry instead of an empty list when the projects could not be read", () => {
    const { flowTarget, ChooseProjectModal, refetchProjects, retryAccess } = setup({ isProjectsError: true, filedDseq: "100", filedProjectId: "storefront" });

    expect(flowTarget().isUnreadable).toBe(true);
    expect(ChooseProjectModal.mock.lastCall?.[0]).toMatchObject({ isUnreadable: true, projects: [] });

    act(() => ChooseProjectModal.mock.lastCall?.[0].onRetry?.());

    expect(refetchProjects).toHaveBeenCalledTimes(1);
    expect(retryAccess).not.toHaveBeenCalled();
  });

  it("keeps the projects it read when a later read of them fails", () => {
    const { flowTarget, ChooseProjectModal } = setup({ isProjectsError: true, hasReadProjects: true, handedOverProjectId: "storefront" });

    expect(flowTarget()).toMatchObject({ isUnreadable: false, project: { id: "storefront" } });
    expect(ChooseProjectModal).not.toHaveBeenCalled();
  });

  it("retries the caller's access when that is what could not be read", () => {
    const { ChooseProjectModal, refetchProjects, retryAccess } = setup({ isAccessError: true });

    act(() => ChooseProjectModal.mock.lastCall?.[0].onRetry?.());

    expect(retryAccess).toHaveBeenCalledTimes(1);
    expect(refetchProjects).not.toHaveBeenCalled();
  });

  it("reports no failed read once the projects are in, or while projects are off", () => {
    expect(setup({ handedOverProjectId: "storefront" }).flowTarget().isUnreadable).toBe(false);
    expect(setup({ isRequired: false, isProjectsError: true, isAccessError: true }).flowTarget().isUnreadable).toBe(false);
  });

  it("lets the flow through without a project while projects are off", () => {
    const { flowTarget } = setup({ isRequired: false, handedOverProjectId: "storefront" });

    expect(screen.getByText("flow")).toBeInTheDocument();
    expect(flowTarget().project).toBeUndefined();
  });

  it("lets a deployment that already exists through while its project is read, without asking for one yet", () => {
    const { flowTarget, ChooseProjectModal } = setup({ filedDseq: "100", filedLocation: "loading" });

    expect(screen.getByText("flow")).toBeInTheDocument();
    expect(flowTarget().isLoading).toBe(true);
    expect(ChooseProjectModal).not.toHaveBeenCalled();
  });

  it("keeps a deployment re-created in place of an existing one in the existing one's project, over a handed over one", () => {
    const { flowTarget, useDeploymentLocationQuery, ChooseProjectModal } = setup({
      filedDseq: "100",
      filedProjectId: "marketing",
      handedOverProjectId: "storefront"
    });

    expect(useDeploymentLocationQuery).toHaveBeenCalledWith("100", { enabled: true });
    expect(flowTarget().project?.id).toBe("marketing");
    expect(ChooseProjectModal).not.toHaveBeenCalled();
  });

  it.each([
    { case: "is filed nowhere the caller reaches", filedProjectId: undefined, filedLocation: undefined },
    { case: "cannot be read", filedProjectId: undefined, filedLocation: "failed" as const },
    { case: "is one the caller only views", filedProjectId: "marketing", filedLocation: undefined }
  ])("asks over a deployment that already exists for a project when its own $case", ({ filedProjectId, filedLocation }) => {
    const { flowTarget, ChooseProjectModal } = setup({ filedDseq: "100", filedProjectId, filedLocation, viewedProjectId: "marketing" });

    expect(screen.getByText("flow")).toBeInTheDocument();
    expect(flowTarget().project).toBeUndefined();
    expect(ChooseProjectModal.mock.lastCall?.[0].projects.map(candidate => candidate.id)).toEqual(["storefront"]);
  });

  it("asks for a project over a deployment that already exists once its project is refused", async () => {
    const { flowTarget, ChooseProjectModal } = setup({ filedDseq: "100", filedProjectId: "storefront" });

    act(() => flowTarget().forgetProject("Choose another one."));

    expect(screen.getByText("flow")).toBeInTheDocument();
    expect(ChooseProjectModal.mock.lastCall?.[0]).toMatchObject({ notice: "Choose another one." });

    await userEvent.click(screen.getByRole("button", { name: "choose marketing" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(flowTarget().project?.id).toBe("marketing");
  });

  it("reads no filed project for a new deployment", () => {
    const { useDeploymentLocationQuery } = setup({});

    expect(useDeploymentLocationQuery).toHaveBeenCalledWith("", { enabled: false });
  });

  it("reads no filed project while projects are off", () => {
    const { useDeploymentLocationQuery } = setup({ isRequired: false, filedDseq: "100" });

    expect(useDeploymentLocationQuery).toHaveBeenCalledWith("100", { enabled: false });
  });

  it("holds the flow back while the organization is still loading, so nothing is created before projects are known", () => {
    const { settleOrganization } = setup({ isOrganizationLoading: true, isRequired: false });

    expect(screen.getByText("waiting")).toBeInTheDocument();
    expect(screen.queryByText("flow")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    settleOrganization();

    expect(screen.getByText("flow")).toBeInTheDocument();
  });

  it("tells the flow a deployment that already exists is filed", () => {
    const { flowTarget } = setup({ filedDseq: "100" });

    expect(flowTarget().isFiled).toBe(true);
  });

  it("holds the flow back while the projects load", () => {
    setup({ isLoading: true, handedOverProjectId: "storefront" });

    expect(screen.getByText("waiting")).toBeInTheDocument();
    expect(screen.queryByText("flow")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks for a project when none was handed over, offering to create one only to a manager", () => {
    const { ChooseProjectModal } = setup({ canManageProjects: false });

    expect(screen.getByText("waiting")).toBeInTheDocument();
    expect(screen.queryByText("flow")).not.toBeInTheDocument();
    expect(ChooseProjectModal.mock.lastCall?.[0]).toMatchObject({ organizationName: "Acme Corp", canCreateProject: false, notice: undefined });
  });

  it("asks for a project when the one handed over is not the organization's", () => {
    setup({ handedOverProjectId: "elsewhere" });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("lets the flow through once a project is picked", async () => {
    const { flowTarget } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "choose marketing" }));

    expect(screen.getByText("flow")).toBeInTheDocument();
    expect(flowTarget().project?.id).toBe("marketing");
  });

  it("abandons the new deployment for the projects page when the first pick is cancelled", async () => {
    const { push } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "cancel" }));

    expect(push).toHaveBeenCalledWith(UrlService.projects());
  });

  it("asks again over the running flow, saying why, when the project is refused", async () => {
    const { flowTarget, ChooseProjectModal } = setup({ handedOverProjectId: "storefront" });

    act(() => flowTarget().forgetProject("Choose another one."));

    expect(screen.getByText("flow")).toBeInTheDocument();
    expect(ChooseProjectModal.mock.lastCall?.[0]).toMatchObject({ notice: "Choose another one." });

    await userEvent.click(screen.getByRole("button", { name: "choose marketing" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(flowTarget()).toMatchObject({ project: { id: "marketing" }, notice: undefined });
  });

  it("keeps the flow when that second pick is cancelled", async () => {
    const { flowTarget, push } = setup({ handedOverProjectId: "storefront" });

    act(() => flowTarget().forgetProject("Choose another one."));
    await userEvent.click(screen.getByRole("button", { name: "cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("flow")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("hands the flow a target that changes project", () => {
    const { flowTarget } = setup({ handedOverProjectId: "storefront" });

    act(() => flowTarget().chooseProject("marketing"));

    expect(flowTarget()).toMatchObject({ isRequired: true, isMissing: false, canCreateProject: true, project: { id: "marketing" } });
  });

  it("offers the picker only the projects the caller may deploy into", () => {
    const { ChooseProjectModal } = setup({ viewedProjectId: "marketing" });

    expect(ChooseProjectModal.mock.lastCall?.[0].projects.map(candidate => candidate.id)).toEqual(["storefront"]);
  });

  it("asks again for a project handed over that the caller only views", () => {
    const { ChooseProjectModal } = setup({ handedOverProjectId: "marketing", viewedProjectId: "marketing" });

    expect(screen.queryByText("flow")).not.toBeInTheDocument();
    expect(ChooseProjectModal).toHaveBeenCalled();
  });

  it("holds the flow back while the caller's access is read", () => {
    const { ChooseProjectModal } = setup({ isLoadingAccess: true });

    expect(screen.getByText("waiting")).toBeInTheDocument();
    expect(ChooseProjectModal).not.toHaveBeenCalled();
  });

  function setup(input: {
    handedOverProjectId?: string;
    filedDseq?: string;
    filedProjectId?: string;
    filedLocation?: "loading" | "failed";
    isRequired?: boolean;
    isLoading?: boolean;
    canManageProjects?: boolean;
    isOrganizationLoading?: boolean;
    viewedProjectId?: string;
    isLoadingAccess?: boolean;
    isProjectsError?: boolean;
    hasReadProjects?: boolean;
    isAccessError?: boolean;
  }) {
    const refetchProjects = vi.fn();
    const retryAccess = vi.fn();
    const organization = { isLoading: input.isOrganizationLoading ?? false };
    const push = vi.fn();
    const projects = [project("storefront"), project("marketing")];
    const store = createStore();
    if (input.handedOverProjectId) store.set(deployTargetProjectIdAtom, input.handedOverProjectId);
    const ChooseProjectModal = vi.fn<typeof DEPENDENCIES.ChooseProjectModal>(({ onChosen, onCancel }) => (
      <div role="dialog">
        <button type="button" onClick={() => onChosen(projects[1])}>
          choose marketing
        </button>
        <button type="button" onClick={onCancel}>
          cancel
        </button>
      </div>
    ));
    const useDeploymentLocationQuery = vi.fn<typeof DEPENDENCIES.useDeploymentLocationQuery>(() =>
      input.filedLocation === "loading"
        ? mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocationQuery>>({ data: undefined, isLoading: true, isError: false })
        : input.filedLocation === "failed"
          ? mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocationQuery>>({ data: undefined, isLoading: false, isError: true })
          : mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocationQuery>>({
              data: input.filedProjectId ? mock<DeploymentLocation>({ projectId: input.filedProjectId }) : null,
              isLoading: false,
              isError: false
            })
    );
    const dependencies: typeof DEPENDENCIES = {
      useProjectsUi: () => ({
        isEnabled: input.isRequired ?? true,
        canManageProjects: input.canManageProjects ?? true,
        canChangeDeployments: true,
        organizationName: "Acme Corp"
      }),
      useProjectsQuery: () =>
        input.isLoading
          ? mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: undefined, isLoading: true, isError: false, refetch: refetchProjects })
          : input.isProjectsError
            ? mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({
                data: input.hasReadProjects ? projects : undefined,
                isLoading: false,
                isError: true,
                refetch: refetchProjects
              })
            : mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: projects, isLoading: false, isError: false, refetch: refetchProjects }),
      useDeploymentLocationQuery,
      useProjectAccess: () =>
        mock<ReturnType<typeof DEPENDENCIES.useProjectAccess>>({
          isLoading: input.isLoadingAccess ?? false,
          isError: input.isAccessError ?? false,
          retry: retryAccess,
          canManageDeployments: projectId => projectId !== input.viewedProjectId
        }),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push }),
      useActiveOrganization: () => mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ isLoading: organization.isLoading }),
      ChooseProjectModal
    };
    let target: ReturnType<typeof useConfigureDeployTarget> | undefined;

    function Flow(): ReactNode {
      target = useConfigureDeployTarget();
      return <p>flow</p>;
    }

    const gate = () => (
      <Provider store={store}>
        <DeployTargetGate filedDseq={input.filedDseq} fallback={<p>waiting</p>} dependencies={dependencies}>
          <Flow />
        </DeployTargetGate>
      </Provider>
    );
    const { rerender } = render(gate());

    return {
      push,
      store,
      ChooseProjectModal,
      useDeploymentLocationQuery,
      refetchProjects,
      retryAccess,
      flowTarget: () => target as ReturnType<typeof useConfigureDeployTarget>,
      settleOrganization: () => {
        organization.isLoading = false;
        rerender(gate());
      }
    };
  }

  function project(name: string): Project {
    return { id: name, name, slug: name, description: null, isDefault: false, createdAt: "2026-01-01T00:00:00.000Z", createdBy: null };
  }
});
