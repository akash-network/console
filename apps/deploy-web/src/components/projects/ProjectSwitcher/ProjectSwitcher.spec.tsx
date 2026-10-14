import { describe, expect, it, vi } from "vitest";

import type { Project } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import { ProjectSwitcher } from "./ProjectSwitcher";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProjectSwitcher.name, () => {
  it("titles the page with the current project", () => {
    setup({});

    expect(screen.getByRole("heading", { level: 1, name: "storefront" })).toBeInTheDocument();
  });

  it("lists the organization's projects, most recently active first, marking the current one", async () => {
    setup({});

    await userEvent.click(screen.getByRole("button", { name: "storefront" }));

    expect(screen.getByText("Projects in Acme Corp")).toBeInTheDocument();
    const projectLinks = screen.getAllByRole("menuitem").filter(item => item.getAttribute("href")?.startsWith("/projects/"));
    expect(projectLinks.map(link => link.textContent)).toEqual(["Mmarketing2 active", "Sstorefront"]);
    expect(screen.getByRole("menuitem", { name: /storefront/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("menuitem", { name: /marketing/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("menuitem", { name: /marketing/ })).toHaveAttribute("href", UrlService.project("marketing"));
  });

  it("lists the default project like any other", async () => {
    setup({ withDefaultProject: true });

    await userEvent.click(screen.getByRole("button", { name: "storefront" }));

    expect(screen.getByRole("menuitem", { name: /default/ })).toHaveAttribute("href", UrlService.project("default"));
  });

  it("offers no new project to a member who cannot create one", async () => {
    setup({ canCreateProject: false });

    await userEvent.click(screen.getByRole("button", { name: "storefront" }));

    expect(screen.getByRole("menuitem", { name: "All projects" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "New project" })).not.toBeInTheDocument();
  });

  it("keeps the current project in the menu even when it would be left out", async () => {
    setup({ currentProjectName: "default", withDefaultProject: true });

    await userEvent.click(screen.getByRole("button", { name: "default" }));

    expect(screen.getByRole("menuitem", { name: /default/ })).toHaveAttribute("aria-current", "page");
  });

  it("leads back to all projects", async () => {
    setup({});

    await userEvent.click(screen.getByRole("button", { name: "storefront" }));

    expect(screen.getByRole("menuitem", { name: "All projects" })).toHaveAttribute("href", UrlService.projects());
  });

  it("starts a new project", async () => {
    const { onNewProject } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "storefront" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "New project" }));

    expect(onNewProject).toHaveBeenCalled();
  });

  function setup(input: { currentProjectName?: string; withDefaultProject?: boolean; canCreateProject?: boolean }) {
    const onNewProject = vi.fn();
    const projects = [
      project("storefront", { createdAt: "2026-01-01T12:00:00.000Z" }),
      project("marketing", { createdAt: "2026-03-01T12:00:00.000Z", deploymentSummary: { activeCount: 2, preview: [] } }),
      ...(input.withDefaultProject ? [project("default", { isDefault: true })] : [])
    ];
    const currentProject = projects.find(candidate => candidate.name === (input.currentProjectName ?? "storefront")) as Project;

    render(
      <ProjectSwitcher
        organizationName="Acme Corp"
        projects={projects}
        currentProject={currentProject}
        onNewProject={input.canCreateProject === false ? undefined : onNewProject}
      />
    );

    return { onNewProject };
  }

  function project(name: string, overrides: Partial<Project> = {}): Project {
    return { id: name, name, slug: name, description: null, isDefault: false, createdAt: "2025-01-01T12:00:00.000Z", createdBy: null, ...overrides };
  }
});
