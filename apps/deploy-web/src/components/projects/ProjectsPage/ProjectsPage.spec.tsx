import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRole } from "@src/types/organization";
import type { OrganizationActivity } from "@src/types/organization-activity";
import type { Project, ProjectDeploymentPreview, ProjectDeploymentSummary } from "@src/types/project";
import type { DEPENDENCIES as NEW_PROJECT_MODAL_DEPENDENCIES } from "../NewProjectModal/NewProjectModal";
import { NewProjectModal } from "../NewProjectModal/NewProjectModal";
import { ProjectFolder } from "../ProjectFolder/ProjectFolder";
import { RecentActivityFeed } from "../RecentActivityFeed/RecentActivityFeed";
import { DEPENDENCIES, ProjectsPage } from "./ProjectsPage";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(ProjectsPage.name, () => {
  it("is not found while organizations are off", () => {
    setup({ isOrganizationsEnabled: false, projects: [project({ name: "storefront" })] });

    expect(screen.getByText("not found")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Projects" })).not.toBeInTheDocument();
  });

  it("is not found for an organization that does not use projects", () => {
    setup({ projectsEnabled: false, projects: [project({ name: "storefront" })] });

    expect(screen.getByText("not found")).toBeInTheDocument();
  });

  it("waits for the active organization before deciding", () => {
    const { Layout } = setup({ isOrganizationLoading: true, projectsEnabled: false, projects: [] });

    expect(Layout.mock.lastCall?.[0]).toMatchObject({ isLoading: true });
    expect(screen.queryByText("not found")).not.toBeInTheDocument();
  });

  it("lets owners and admins manage each project from its folder", () => {
    setup({ role: "admin", projects: [project({ name: "storefront" })] });

    expect(screen.getByRole("button", { name: "menu of storefront" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New project" })).toBeInTheDocument();
  });

  it.each(["member", "viewer", "billing"] as const)("offers a %s no way to create or manage projects", role => {
    setup({ role, projects: [project({ name: "storefront" })] });

    expect(screen.queryByRole("button", { name: "New project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "menu of storefront" })).not.toBeInTheDocument();
  });

  it("lets a member start a deployment in a project", () => {
    setup({ role: "member", projects: [project({ name: "storefront" })] });

    expect(screen.getByRole("link", { name: /New deployment/ })).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /^Open storefront/ })).getByText("New deployment")).toBeInTheDocument();
  });

  it.each(["viewer", "billing"] as const)("offers a %s no way to start a deployment", role => {
    setup({ role, projects: [project({ name: "storefront" })] });

    expect(screen.queryByRole("link", { name: /New deployment/ })).not.toBeInTheDocument();
    expect(screen.queryByText("New deployment")).not.toBeInTheDocument();
  });

  it("lists the default project for a member granted only it, even with nothing running in it", () => {
    setup({ role: "member", projects: [project({ name: "default", isDefault: true })] });

    expect(screen.getByRole("link", { name: /^Open default/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New deployment/ })).toBeInTheDocument();
    expect(screen.queryByText("You don't have access to any project yet. Ask an owner or admin.")).not.toBeInTheDocument();
  });

  it("explains to a member without projects that access comes from an owner or admin", () => {
    setup({ role: "member", projects: [] });

    expect(screen.getByText("You don't have access to any project yet. Ask an owner or admin.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create your first project" })).not.toBeInTheDocument();
  });

  it("offers to retry the activity when it cannot be loaded", async () => {
    const { retryActivity } = setup({ projects: [project({ name: "storefront" })], isActivityError: true });

    await userEvent.click(within(screen.getByRole("region", { name: "Recent activity" })).getByRole("button", { name: "Retry" }));

    expect(retryActivity).toHaveBeenCalledTimes(1);
  });

  it("invites to create the first project when the organization has none", () => {
    setup({ projects: [] });

    expect(screen.getByText("0 projects in Acme Corp")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create your first project" })).toBeInTheDocument();
    expect(screen.getByText("A project groups the deployments behind one app or service.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New project" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: /New deployment/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ projects?$/)).not.toBeInTheDocument();
  });

  it("treats an organization holding only an untouched default project as empty", () => {
    setup({ projects: [project({ name: "default", isDefault: true })] });

    expect(screen.getByRole("heading", { name: "Create your first project" })).toBeInTheDocument();
  });

  it("shows the default project to a manager when its deployments cannot be read", () => {
    setup({ projects: [project({ name: "default", isDefault: true, deployments: [running("2718")] })], isSummaryUnread: true });

    expect(screen.getByRole("link", { name: "Open default" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create your first project" })).not.toBeInTheDocument();
  });

  it("files the projects as folders, newest first, each with its open deployments, and counts them", () => {
    setup({
      projects: [
        project({ name: "storefront", createdAt: "2025-10-28T12:00:00.000Z", deployments: [running("3140")] }),
        project({ name: "marketing", createdAt: "2026-01-10T12:00:00.000Z" }),
        project({ name: "default", isDefault: true, createdAt: "2025-01-01T12:00:00.000Z", deployments: [running("2718"), running("1618")] })
      ]
    });

    const folders = screen.getAllByRole("link", { name: /^Open / });
    expect(folders.map(folder => folder.getAttribute("aria-label"))).toEqual([
      "Open marketing, 0 active deployments",
      "Open storefront, 1 active deployment",
      "Open default, 2 active deployments"
    ]);
    expect(screen.getByText("3 projects")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New deployment/ })).toHaveAttribute("href", "/new-deployment");
  });

  it("counts a single project in the singular", () => {
    setup({ projects: [project({ name: "storefront" })] });

    expect(screen.getByText("1 project")).toBeInTheDocument();
  });

  it("opens a project, a deployment or a new deployment in the project from its folder", async () => {
    const { push } = setup({
      projects: [project({ name: "storefront", deployments: [running("3140", "acme-storefront")] }), project({ name: "marketing" })]
    });

    await userEvent.click(screen.getByRole("link", { name: /^Open storefront/ }));
    await userEvent.click(screen.getByText("acme-storefront"));
    await userEvent.click(within(screen.getByRole("link", { name: /^Open marketing/ })).getByText("New deployment"));

    expect(push.mock.calls).toEqual([["/projects/storefront"], ["/deployments/3140"], ["/new-deployment?projectId=marketing"]]);
  });

  it("offers no new deployment from the folder of a project the caller only views", () => {
    setup({ projects: [project({ name: "storefront" }), project({ name: "marketing" })], viewedProjectIds: ["marketing"] });

    expect(within(screen.getByRole("link", { name: /^Open storefront/ })).getByText("New deployment")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /^Open marketing/ })).queryByText("New deployment")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /New deployment/ })).toHaveLength(1);
  });

  it("offers no new deployment at all to a caller who only views every project", () => {
    setup({ projects: [project({ name: "storefront" })], viewedProjectIds: ["storefront"] });

    expect(screen.queryByRole("link", { name: /New deployment/ })).not.toBeInTheDocument();
    expect(screen.queryByText("New deployment")).not.toBeInTheDocument();
  });

  it("reads a folder's deployments only once it scrolls into view", () => {
    const { useProjectDeploymentSummaryQuery } = setup({
      projects: [project({ name: "storefront", deployments: [running("3140")] })],
      isScrolledIntoView: false
    });

    expect(useProjectDeploymentSummaryQuery).toHaveBeenCalledWith("storefront", { enabled: false });
    expect(screen.getByRole("link", { name: "Open storefront" })).toBeInTheDocument();
  });

  it("reads the default project's deployments up front, since they decide whether it is shown", () => {
    const { useProjectDeploymentSummaryQuery } = setup({ projects: [project({ name: "default", isDefault: true })], isScrolledIntoView: false });

    expect(useProjectDeploymentSummaryQuery).toHaveBeenCalledWith("default", { enabled: true });
  });

  it("asks for no deployments before it knows the organization's projects", () => {
    const { useProjectDeploymentSummaryQuery } = setup({ projects: [], isError: true });

    expect(useProjectDeploymentSummaryQuery).toHaveBeenCalledWith("", { enabled: false });
  });

  it("waits for the default project's deployments before calling the organization empty", () => {
    const { Layout } = setup({ projects: [project({ name: "default", isDefault: true })], isReadingDefaultProject: true });

    expect(Layout.mock.lastCall?.[0]).toMatchObject({ isLoading: true });
    expect(screen.queryByRole("heading", { name: "Create your first project" })).not.toBeInTheDocument();
  });

  it("opens the new project modal knowing every name in use, and closes it once a project is created", async () => {
    const { createProject } = setup({ projects: [project({ name: "default", isDefault: true }), project({ name: "Storefront" })] });

    await userEvent.click(screen.getByRole("button", { name: "New project" }));
    const dialog = await screen.findByRole("dialog", { name: "New project" });
    await userEvent.type(within(dialog).getByLabelText("Project name"), "storefront");
    expect(within(dialog).getByText("A project named storefront already exists.")).toBeInTheDocument();

    await userEvent.clear(within(dialog).getByLabelText("Project name"));
    await userEvent.type(within(dialog).getByLabelText("Project name"), "staging{Enter}");

    expect(createProject).toHaveBeenCalledWith({ data: { name: "staging" } });
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the organization's recent activity next to the projects", () => {
    setup({
      projects: [project({ name: "storefront" })],
      activities: [
        {
          id: "a1",
          projectId: "storefront",
          actor: { id: "u1", username: "marcus" },
          type: "deployment_created",
          payload: { dseq: "3140", name: "acme-storefront" },
          createdAt: new Date().toISOString()
        }
      ]
    });

    const feed = screen.getByRole("region", { name: "Recent activity" });
    expect(feed).toHaveTextContent("marcus deployed acme-storefront");
    expect(within(feed).getByRole("link", { name: "storefront" })).toHaveAttribute("href", "/projects/storefront");
  });

  it("offers to retry when the projects cannot be loaded", async () => {
    const { refetch } = setup({ projects: [], isError: true });

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "Create your first project" })).not.toBeInTheDocument();
  });

  function setup(input: {
    isOrganizationsEnabled?: boolean;
    projects: SummarizedProject[];
    activities?: OrganizationActivity[];
    isError?: boolean;
    isScrolledIntoView?: boolean;
    isReadingDefaultProject?: boolean;
    isSummaryUnread?: boolean;
    role?: OrganizationRole;
    projectsEnabled?: boolean;
    isOrganizationLoading?: boolean;
    isActivityError?: boolean;
    viewedProjectIds?: string[];
  }) {
    const retryActivity = vi.fn();
    const push = vi.fn();
    const refetch = vi.fn();
    const createProject = vi.fn(async ({ data }: { data: { name: string } }) => ({ data: project({ name: data.name }).project }));
    const summaries = new Map(input.projects.map(({ project: { id }, summary }) => [id, summary]));
    const useProjectDeploymentSummaryQuery = vi.fn<typeof DEPENDENCIES.useProjectDeploymentSummaryQuery>((projectId, options) =>
      input.isReadingDefaultProject
        ? mock<ReturnType<typeof DEPENDENCIES.useProjectDeploymentSummaryQuery>>({ data: undefined, isLoading: true, isError: false })
        : mock<ReturnType<typeof DEPENDENCIES.useProjectDeploymentSummaryQuery>>({
            data: options?.enabled && !input.isSummaryUnread ? summaries.get(projectId) : undefined,
            isLoading: false,
            isError: input.isSummaryUnread ?? false
          })
    );
    const Layout = vi.fn<typeof DEPENDENCIES.Layout>(({ children }) => <>{children}</>);

    const dependencies = MockComponents(DEPENDENCIES, {
      useFlag: flag => flag === "organizations" && (input.isOrganizationsEnabled ?? true),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push }),
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          isLoading: input.isOrganizationLoading ?? false,
          projectsEnabled: input.projectsEnabled ?? true,
          activeOrganization: { id: "org-1", name: "Acme Corp", slug: "acme-corp", type: "team", role: input.role ?? "owner", isActive: true, createdAt: "" }
        }),
      useProjectsQuery: () =>
        mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({
          data: input.isError ? undefined : input.projects.map(({ project }) => project),
          isLoading: false,
          isError: input.isError ?? false,
          refetch
        }),
      useOrganizationActivitiesQuery: () => ({
        activities: input.activities ?? [],
        isLoading: false,
        isError: input.isActivityError ?? false,
        hasMore: false,
        showMore: vi.fn(),
        retry: retryActivity
      }),
      useNewDeploymentUrl: () => () => "/new-deployment",
      useProjectAccess: () => {
        const canManageDeployments = (projectId: string | null | undefined) => !input.viewedProjectIds?.includes(projectId ?? "");
        return mock<ReturnType<typeof DEPENDENCIES.useProjectAccess>>({
          canManageDeployments,
          canDeployAnywhere: input.projects.some(({ project }) => canManageDeployments(project.id))
        });
      },
      useProjectDeploymentSummaryQuery,
      useHasBeenVisible: () => [vi.fn(), input.isScrolledIntoView ?? true],
      Layout,
      NotFoundPage: () => <div>not found</div>,
      ProjectFolder,
      ProjectFolderMenu: ({ project }) => <button type="button">menu of {project.name}</button>,
      RecentActivityFeed,
      NewProjectModal: props => (
        <NewProjectModal
          {...props}
          dependencies={{
            useCreateProjectMutation: () =>
              mock<ReturnType<typeof NEW_PROJECT_MODAL_DEPENDENCIES.useCreateProjectMutation>>({ mutateAsync: createProject, isPending: false }),
            useSnackbar: () => mock<ReturnType<typeof NEW_PROJECT_MODAL_DEPENDENCIES.useSnackbar>>({ enqueueSnackbar: vi.fn() })
          }}
        />
      )
    });

    render(<ProjectsPage dependencies={dependencies} />);

    return { push, refetch, createProject, useProjectDeploymentSummaryQuery, Layout, retryActivity };
  }
});

type SummarizedProject = { project: Project; summary: ProjectDeploymentSummary };

function project(input: { name: string; createdAt?: string; isDefault?: boolean; deployments?: ProjectDeploymentPreview[] }): SummarizedProject {
  return {
    project: {
      id: input.name,
      name: input.name,
      slug: input.name.toLowerCase(),
      description: null,
      isDefault: input.isDefault ?? false,
      createdAt: input.createdAt ?? "2026-01-01T12:00:00.000Z",
      createdBy: null
    },
    summary: { activeCount: input.deployments?.length ?? 0, preview: input.deployments ?? [] }
  };
}

function running(dseq: string, name = `deployment-${dseq}`): ProjectDeploymentPreview {
  return { dseq, name, status: "running" };
}
