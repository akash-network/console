import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Project } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./DeploymentProjectChip";
import { DeploymentProjectChip } from "./DeploymentProjectChip";

import { render, screen } from "@testing-library/react";

describe(DeploymentProjectChip.name, () => {
  it("names the project a deployment is filed under and links to it", () => {
    setup({ projectId: "project-1" });

    expect(screen.getByRole("link", { name: "Project storefront" })).toHaveAttribute("href", UrlService.project("project-1"));
  });

  it("shows nothing while projects are off, without fetching them", () => {
    const { useProjectsQuery } = setup({ projectId: "project-1", isEnabled: false });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("shows nothing for a deployment filed under no known project", () => {
    setup({ projectId: "elsewhere" });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows nothing on the page of the project it would name", () => {
    setup({ projectId: "project-1", scopedProjectId: "project-1" });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("still names the project on another project's page", () => {
    setup({ projectId: "project-1", scopedProjectId: "project-2" });

    expect(screen.getByRole("link", { name: "Project storefront" })).toBeInTheDocument();
  });

  function setup(input: { projectId: string | undefined; isEnabled?: boolean; scopedProjectId?: string }) {
    const useProjectsQuery = vi.fn<typeof DEPENDENCIES.useProjectsQuery>(() =>
      mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: [mock<Project>({ id: "project-1", name: "storefront" })] })
    );
    const dependencies: typeof DEPENDENCIES = {
      useProjectsUi: () => ({ isEnabled: input.isEnabled ?? true, canManageProjects: false, canChangeDeployments: true, organizationName: "Acme Corp" }),
      useProjectsQuery,
      useProjectScope: () => input.scopedProjectId ?? null
    };

    render(<DeploymentProjectChip projectId={input.projectId} dependencies={dependencies} />);

    return { useProjectsQuery };
  }
});
