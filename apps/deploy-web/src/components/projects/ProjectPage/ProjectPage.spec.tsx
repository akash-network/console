import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRole, OrganizationType } from "@src/types/organization";
import type { Project } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, ProjectPage } from "./ProjectPage";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(ProjectPage.name, () => {
  it("is not found while organizations are off", () => {
    const { DeploymentsList } = setup({ isOrganizationsEnabled: false });

    expect(screen.getByText("not found")).toBeInTheDocument();
    expect(DeploymentsList).not.toHaveBeenCalled();
  });

  it("waits for the projects before deciding the project exists", () => {
    const { Layout } = setup({ isLoading: true });

    expect(Layout.mock.lastCall?.[0]).toMatchObject({ isLoading: true });
    expect(screen.queryByText("not found")).not.toBeInTheDocument();
  });

  it("reads a project the caller cannot see as one that does not exist", () => {
    setup({ projectId: "elsewhere" });

    expect(screen.getByText("not found")).toBeInTheDocument();
  });

  it("lists the project's deployments under its own title", () => {
    const { DeploymentsList, ProjectSwitcher } = setup({});

    expect(DeploymentsList.mock.lastCall?.[0].project).toMatchObject({ id: "storefront", name: "storefront" });
    expect(screen.getByRole("button", { name: "new project" })).toBeInTheDocument();
    expect(ProjectSwitcher.mock.lastCall?.[0]).toMatchObject({ organizationName: "Acme Corp", currentProject: { id: "storefront" } });
  });

  it("starts the list afresh when switching to another project", async () => {
    const { openProject } = setup({});
    await userEvent.type(screen.getByRole("textbox", { name: "search" }), "api");

    openProject("marketing");

    expect(screen.getByRole("textbox", { name: "search" })).toHaveValue("");
  });

  it("shows the project's spend, activity and members in the side column of a team organization", () => {
    const { useOrganizationActivitiesQuery, ProjectBudgetPanel, ProjectMembersPreview, RecentActivityFeed } = setup({});

    expect(useOrganizationActivitiesQuery).toHaveBeenCalledWith({ projectId: "storefront" });
    expect(ProjectBudgetPanel.mock.lastCall?.[0]).toMatchObject({ projectId: "storefront", projectName: "storefront" });
    expect(ProjectMembersPreview.mock.lastCall?.[0]).toMatchObject({ project: { id: "storefront", name: "storefront" }, organizationName: "Acme Corp" });
    expect(RecentActivityFeed.mock.lastCall?.[0]).toMatchObject({ hasMore: true });
  });

  it("leaves members out for a billing member, who cannot read them, but shows the spend", () => {
    const { ProjectBudgetPanel, ProjectMembersPreview } = setup({ role: "billing" });

    expect(ProjectBudgetPanel).toHaveBeenCalled();
    expect(ProjectMembersPreview).not.toHaveBeenCalled();
  });

  it("names each activity's project nowhere, since all of them are this project's", () => {
    const { RecentActivityFeed, retryActivity } = setup({});

    expect(RecentActivityFeed.mock.lastCall?.[0]).toMatchObject({ showsProjects: false, isError: false, onRetry: retryActivity });
  });

  it("is not found for an organization that does not use projects", () => {
    const { DeploymentsList } = setup({ projectsEnabled: false });

    expect(screen.getByText("not found")).toBeInTheDocument();
    expect(DeploymentsList).not.toHaveBeenCalled();
  });

  it("waits for the active organization before deciding", () => {
    const { Layout } = setup({ isOrganizationLoading: true, projectsEnabled: false });

    expect(Layout.mock.lastCall?.[0]).toMatchObject({ isLoading: true });
    expect(screen.queryByText("not found")).not.toBeInTheDocument();
  });

  it("offers to retry when the projects cannot be loaded, rather than calling the project missing", async () => {
    const { refetch } = setup({ isError: true });

    expect(screen.getByText("Couldn't load the project.")).toBeInTheDocument();
    expect(screen.queryByText("not found")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it.each(["member", "viewer", "billing"] as const)("offers a %s no new project from the title menu", role => {
    const { ProjectSwitcher } = setup({ role });

    expect(ProjectSwitcher.mock.lastCall?.[0].onNewProject).toBeUndefined();
  });

  it("opens a project created from the title menu", async () => {
    const { push, NewProjectModal } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "new project" }));

    expect(NewProjectModal.mock.lastCall?.[0]).toMatchObject({ organizationName: "Acme Corp", existingSlugs: ["storefront", "marketing"] });
    await userEvent.click(screen.getByRole("button", { name: "created" }));

    expect(push).toHaveBeenCalledWith(UrlService.project("checkout-api"));
    expect(screen.queryByRole("button", { name: "created" })).not.toBeInTheDocument();
  });

  it("closes the new project modal without leaving the page", async () => {
    const { push } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "new project" }));
    await userEvent.click(screen.getByRole("button", { name: "close" }));

    expect(screen.queryByRole("button", { name: "created" })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  function setup(input: {
    isOrganizationsEnabled?: boolean;
    isLoading?: boolean;
    isError?: boolean;
    projectId?: string;
    organizationType?: OrganizationType;
    role?: OrganizationRole;
    projectsEnabled?: boolean;
    isOrganizationLoading?: boolean;
  }) {
    const refetch = vi.fn();
    const retryActivity = vi.fn();
    const push = vi.fn();
    const projects = [project("storefront"), project("marketing")];
    const useOrganizationActivitiesQuery = vi.fn<typeof DEPENDENCIES.useOrganizationActivitiesQuery>(() => ({
      activities: [],
      isLoading: false,
      isError: false,
      hasMore: true,
      showMore: vi.fn(),
      retry: retryActivity
    }));
    const Layout = vi.fn<typeof DEPENDENCIES.Layout>(({ children }) => <>{children}</>);
    const DeploymentsList = vi.fn<typeof DEPENDENCIES.DeploymentsList>(({ project }) => (
      <>
        <input aria-label="search" />
        {project?.title}
        {project?.aside as ReactNode}
      </>
    ));
    const ProjectSwitcher = vi.fn<typeof DEPENDENCIES.ProjectSwitcher>(({ onNewProject }) => (
      <button type="button" onClick={onNewProject}>
        new project
      </button>
    ));
    const NewProjectModal = vi.fn<typeof DEPENDENCIES.NewProjectModal>(({ onCreated, onClose }) => (
      <>
        <button type="button" onClick={() => onCreated(project("checkout-api"))}>
          created
        </button>
        <button type="button" onClick={onClose}>
          close
        </button>
      </>
    ));
    const ProjectBudgetPanel = vi.fn<typeof DEPENDENCIES.ProjectBudgetPanel>(() => <></>);
    const ProjectMembersPreview = vi.fn<typeof DEPENDENCIES.ProjectMembersPreview>(() => <></>);
    const RecentActivityFeed = vi.fn<typeof DEPENDENCIES.RecentActivityFeed>(() => <></>);
    const dependencies = MockComponents(DEPENDENCIES, {
      useFlag: flag => flag === "organizations" && (input.isOrganizationsEnabled ?? true),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push }),
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          isLoading: input.isOrganizationLoading ?? false,
          projectsEnabled: input.projectsEnabled ?? true,
          activeOrganization: {
            id: "org-1",
            name: "Acme Corp",
            slug: "acme-corp",
            type: input.organizationType ?? "team",
            role: input.role ?? "owner",
            isActive: true,
            createdAt: ""
          }
        }),
      useProjectsQuery: () =>
        input.isLoading
          ? mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: undefined, isLoading: true })
          : input.isError
            ? mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: undefined, isLoading: false, isError: true, refetch })
            : mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: projects, isLoading: false, isError: false }),
      useOrganizationActivitiesQuery,
      Layout,
      NotFoundPage: () => <div>not found</div>,
      DeploymentsList,
      ProjectSwitcher,
      ProjectBudgetPanel,
      ProjectMembersPreview,
      RecentActivityFeed,
      NewProjectModal
    });

    const { rerender } = render(<ProjectPage projectId={input.projectId ?? "storefront"} dependencies={dependencies} />);
    const openProject = (projectId: string) => rerender(<ProjectPage projectId={projectId} dependencies={dependencies} />);

    return {
      openProject,
      push,
      refetch,
      retryActivity,
      Layout,
      DeploymentsList,
      ProjectSwitcher,
      NewProjectModal,
      ProjectBudgetPanel,
      ProjectMembersPreview,
      RecentActivityFeed,
      useOrganizationActivitiesQuery
    };
  }

  function project(name: string): Project {
    return { id: name, name, slug: name, description: null, isDefault: false, createdAt: "2026-01-01T12:00:00.000Z", createdBy: null };
  }
});
