import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Project } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./DeploymentProjectBreadcrumb";
import { DeploymentProjectBreadcrumb } from "./DeploymentProjectBreadcrumb";

import { render, screen, within } from "@testing-library/react";

describe(DeploymentProjectBreadcrumb.name, () => {
  it("leads from the deployment back to its project and to all projects", () => {
    const { useDeploymentLocationQuery } = setup({ locatedProjectId: "project-1" });

    const breadcrumb = within(screen.getByRole("navigation", { name: "Breadcrumb" }));
    expect(breadcrumb.getByRole("link", { name: "Projects" })).toHaveAttribute("href", UrlService.projects());
    expect(breadcrumb.getByRole("link", { name: "storefront" })).toHaveAttribute("href", UrlService.project("project-1"));
    expect(breadcrumb.getByRole("link", { name: "storefront" })).toHaveAttribute("aria-current", "page");
    expect(useDeploymentLocationQuery).toHaveBeenCalledWith("100", { enabled: true });
  });

  it("shows nothing while projects are off, without asking where the deployment is", () => {
    const { useDeploymentLocationQuery, useProjectsQuery } = setup({ locatedProjectId: "project-1", isEnabled: false });

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(useDeploymentLocationQuery).toHaveBeenCalledWith("100", { enabled: false });
    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("shows nothing for a deployment the api has not filed", () => {
    setup({ locatedProjectId: undefined });

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  function setup(input: { locatedProjectId: string | undefined; isEnabled?: boolean }) {
    const useDeploymentLocationQuery = vi.fn<typeof DEPENDENCIES.useDeploymentLocationQuery>(() =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocationQuery>>({
        data: input.locatedProjectId ? { organizationId: "org-1", organizationSlug: "acme-corp", projectId: input.locatedProjectId } : null
      })
    );
    const useProjectsQuery = vi.fn<typeof DEPENDENCIES.useProjectsQuery>(() =>
      mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: [mock<Project>({ id: "project-1", name: "storefront" })] })
    );
    const dependencies: typeof DEPENDENCIES = {
      useProjectsUi: () => ({ isEnabled: input.isEnabled ?? true, canManageProjects: false, canChangeDeployments: true, organizationName: "Acme Corp" }),
      useDeploymentLocationQuery,
      useProjectsQuery
    };

    render(<DeploymentProjectBreadcrumb dseq="100" dependencies={dependencies} />);

    return { useDeploymentLocationQuery, useProjectsQuery };
  }
});
