import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRole } from "@src/types/organization";
import type { Project } from "@src/types/project";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./ProjectBudgetRefusal";
import { ProjectBudgetRefusal } from "./ProjectBudgetRefusal";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProjectBudgetRefusal.name, () => {
  it("names the project at its budget and takes an owner to it", async () => {
    const { onNavigate } = setup({ projectId: "storefront", role: "owner" });

    expect(screen.getByText(/past its monthly budget, so it wasn't started/)).toHaveTextContent(
      "Starting this deployment would take storefront past its monthly budget, so it wasn't started."
    );
    const link = screen.getByRole("link", { name: "Review the project's budget" });
    expect(link).toHaveAttribute("href", UrlService.project("storefront"));
    link.addEventListener("click", event => event.preventDefault());

    await userEvent.click(link);
    expect(onNavigate).toHaveBeenCalled();
  });

  it("takes an admin to the project too", () => {
    setup({ projectId: "storefront", role: "admin" });

    expect(screen.getByRole("link", { name: "Review the project's budget" })).toBeInTheDocument();
  });

  it("offers no link while the organization does not work in projects", () => {
    setup({ projectId: "storefront", role: "owner", projectsEnabled: false });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("An owner or admin can raise the budget.")).toBeInTheDocument();
  });

  it("tells anyone else who can raise the budget", () => {
    setup({ projectId: "storefront", role: "member" });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("An owner or admin can raise the budget.")).toBeInTheDocument();
  });

  it("speaks of the project generically when it is not known", () => {
    const { useProjectsQuery } = setup({ projectId: undefined, role: "owner" });

    expect(screen.getByText(/past its monthly budget/)).toHaveTextContent("Starting this deployment would take the project past its monthly budget");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("speaks of the project generically when it is not among the caller's projects", () => {
    setup({ projectId: "elsewhere", role: "owner" });

    expect(screen.getByText(/past its monthly budget/)).toHaveTextContent("would take the project past");
  });

  function setup(input: { projectId: string | undefined; role: OrganizationRole; projectsEnabled?: boolean }) {
    const onNavigate = vi.fn();
    const projects: Project[] = [
      { id: "storefront", name: "storefront", slug: "storefront", description: null, isDefault: false, createdAt: "2026-01-01T00:00:00.000Z", createdBy: null }
    ];
    const useProjectsQuery = vi.fn<typeof DEPENDENCIES.useProjectsQuery>(() => mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: projects }));

    render(
      <ProjectBudgetRefusal
        projectId={input.projectId}
        onNavigate={onNavigate}
        dependencies={{
          useActiveOrganization: () =>
            mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
              projectsEnabled: input.projectsEnabled ?? true,
              activeOrganization: { id: "org-1", name: "Acme Corp", slug: "acme-corp", type: "team", role: input.role, isActive: true, createdAt: "" }
            }),
          useProjectsQuery
        }}
      />
    );

    return { onNavigate, useProjectsQuery };
  }
});
