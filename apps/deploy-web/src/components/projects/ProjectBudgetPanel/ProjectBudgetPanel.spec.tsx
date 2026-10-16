import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRole } from "@src/types/organization";
import type { ProjectRole } from "@src/types/project";
import type { ProjectBudget, ProjectSpend, ProjectSpendReport } from "@src/types/project-budget";
import { thisMonthSpendRange } from "../projectSpend";
import { DEPENDENCIES, ProjectBudgetPanel } from "./ProjectBudgetPanel";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(ProjectBudgetPanel.name, () => {
  it("compares the month's committed spend with the budget", () => {
    const { useProjectSpendQuery } = setup({ budget: budget({ committedUsd: 120 }) });

    expect(screen.getByText("$120.00")).toBeInTheDocument();
    expect(screen.getByText("committed of $500.00 monthly budget")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "24% of the monthly budget committed" })).toBeInTheDocument();
    expect(screen.getByText("24% used")).toBeInTheDocument();
    expect(screen.getByText("Alert at 80%")).toBeInTheDocument();
    expect(useProjectSpendQuery).toHaveBeenCalledWith(thisMonthSpendRange());
  });

  it("judges the budget by the figure deposits are checked against", () => {
    setup({ budget: budget({ committedUsd: 120 }), spend: spend({ committedUsd: 150 }) });

    expect(screen.getByText("$120.00")).toBeInTheDocument();
    expect(screen.queryByText("$150.00")).not.toBeInTheDocument();
    expect(screen.getByText("Counts deposits recorded since budgets started, so this month it can differ from the spend report.")).toBeInTheDocument();
  });

  it("explains no difference when the budget and the report agree", () => {
    setup({ budget: budget({ committedUsd: 120 }), spend: spend({ committedUsd: 120 }) });

    expect(screen.queryByText(/Counts deposits recorded since budgets started/)).not.toBeInTheDocument();
  });

  it("floors the share used, so a month just short of the alert does not read as reaching it", () => {
    setup({ budget: budget({ committedUsd: 399.9 }) });

    expect(screen.getByText("79% used")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "79% of the monthly budget committed" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not round a month just short of the budget up to a full one", () => {
    setup({ budget: budget({ committedUsd: 498 }) });

    expect(screen.getByText("99% used")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Past the alert threshold.");
  });

  it("shows how far past the budget the month went while keeping the bar full", () => {
    setup({ budget: budget({ committedUsd: 650 }) });

    expect(screen.getByText("130% used")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "130% of the monthly budget committed" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });

  it("shows the month's committed spend alone when there is no budget", () => {
    setup({ budget: null, spend: spend({ committedUsd: 42.5 }) });

    expect(screen.getByText("$42.50")).toBeInTheDocument();
    expect(screen.getByText("committed this month")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("counts nothing committed for a project with no spend yet", () => {
    setup({ budget: null, spend: null });

    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.queryByText("Consumed this month")).not.toBeInTheDocument();
  });

  it("marks what running deployments used as estimated while the chain has not settled it", () => {
    setup({ spend: spend({ consumedUsd: 33.1, estimatedConsumedUsd: 2 }) });

    expect(screen.getByText("Consumed this month")).toBeInTheDocument();
    expect(screen.getByText("$33.10")).toBeInTheDocument();
    expect(screen.getByText("Estimated")).toBeInTheDocument();
  });

  it("leaves the estimate marker off settled figures", () => {
    setup({ spend: spend({ consumedUsd: 33.1, estimatedConsumedUsd: 0 }) });

    expect(screen.queryByText("Estimated")).not.toBeInTheDocument();
  });

  it("warns once committed spend passes the alert threshold", () => {
    setup({ budget: budget({ committedUsd: 410 }) });

    expect(screen.getByRole("status")).toHaveTextContent("Past the alert threshold.");
  });

  it("says new deployments are refused once the budget is reached", () => {
    setup({ budget: budget({ committedUsd: 500 }) });

    expect(screen.getByRole("status")).toHaveTextContent("Budget reached. New deployments in this project are refused");
  });

  it("says nothing about the standing while the month is within budget", () => {
    setup({ budget: budget({ committedUsd: 10 }) });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says whether top-ups stop at the budget", () => {
    setup({ budget: budget({ stopTopUps: true }) });

    expect(screen.getByText("Top-ups stop at the budget.")).toBeInTheDocument();
  });

  it("says top-ups continue past the budget by default", () => {
    setup({ budget: budget({ stopTopUps: false }) });

    expect(screen.getByText("Top-ups continue past the budget.")).toBeInTheDocument();
  });

  it("lets an owner set a budget for a project without one", async () => {
    const { ProjectBudgetDialog } = setup({ budget: null, organizationRole: "owner" });

    await userEvent.click(screen.getByRole("button", { name: "Set budget" }));

    expect(ProjectBudgetDialog.mock.lastCall?.[0]).toMatchObject({ projectId: "storefront", projectName: "storefront", budget: null });
  });

  it("lets an admin edit the budget and closes the editor when it is done", async () => {
    const existingBudget = budget({});
    const { ProjectBudgetDialog } = setup({ budget: existingBudget, organizationRole: "admin" });

    await userEvent.click(screen.getByRole("button", { name: "Edit budget" }));
    expect(ProjectBudgetDialog.mock.lastCall?.[0]).toMatchObject({ budget: existingBudget });

    await userEvent.click(screen.getByRole("button", { name: "close editor" }));
    expect(screen.queryByRole("button", { name: "close editor" })).not.toBeInTheDocument();
  });

  it("shows billing the budget without a way to change it", () => {
    const { useProjectBudgetQuery, useProjectMembersQuery } = setup({ budget: budget({}), organizationRole: "billing" });

    expect(screen.getByText("committed of $500.00 monthly budget")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit budget" })).not.toBeInTheDocument();
    expect(useProjectBudgetQuery).toHaveBeenCalledWith("storefront", { enabled: true });
    expect(useProjectMembersQuery).toHaveBeenCalledWith("storefront", { enabled: false });
  });

  it("tells billing who can set a budget when the project has none", () => {
    setup({ budget: null, organizationRole: "billing" });

    expect(screen.getByText("No monthly budget. An owner or admin can set one.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set budget" })).not.toBeInTheDocument();
  });

  it("shows a member the budget of a project it administers, read only", () => {
    const { useProjectBudgetQuery, useProjectMembersQuery } = setup({ budget: budget({}), organizationRole: "member", projectRole: "admin" });

    expect(useProjectMembersQuery).toHaveBeenCalledWith("storefront", { enabled: true });
    expect(useProjectBudgetQuery).toHaveBeenCalledWith("storefront", { enabled: true });
    expect(screen.getByText("committed of $500.00 monthly budget")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit budget" })).not.toBeInTheDocument();
  });

  it("shows other members and viewers only the spend", () => {
    const { useProjectBudgetQuery } = setup({ budget: budget({}), organizationRole: "member", projectRole: "member", spend: spend({ committedUsd: 9 }) });

    expect(useProjectBudgetQuery).toHaveBeenCalledWith("storefront", { enabled: false });
    expect(screen.getByText("$9.00")).toBeInTheDocument();
    expect(screen.queryByText(/monthly budget/)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/Top-ups/)).not.toBeInTheDocument();
  });

  it("does not mistake another member's admin grant for the caller's", () => {
    const { useProjectBudgetQuery } = setup({ budget: budget({}), organizationRole: "member", projectRole: "admin", grantHolderId: "user-2" });

    expect(useProjectBudgetQuery).toHaveBeenCalledWith("storefront", { enabled: false });
    expect(screen.queryByText(/monthly budget/)).not.toBeInTheDocument();
  });

  it("waits for the budget before saying the project has none", () => {
    setup({ budget: null, isReadingBudget: true });

    expect(screen.queryByText("No monthly budget.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set budget" })).not.toBeInTheDocument();
  });

  it("says when the spend cannot be loaded", () => {
    setup({ isSpendError: true });

    expect(screen.getByText("Couldn't load this project's spend.")).toBeInTheDocument();
  });

  it("states that a budget limits new deposits and leaves running deployments funded by default", () => {
    setup({ budget: budget({ stopTopUps: false }) });

    expect(
      screen.getByText(
        "A budget limits new deposits into this project each month and doesn't set money aside. Running deployments keep their funding unless top-ups stop at the budget."
      )
    ).toBeInTheDocument();
  });

  it("warns that running deployments can run out of funds once top-ups stop at the budget", () => {
    setup({ budget: budget({ stopTopUps: true }) });

    expect(
      screen.getByText(
        "A budget limits new deposits into this project each month and doesn't set money aside. Top-ups stop at the budget, so running deployments can run out of funds and close."
      )
    ).toBeInTheDocument();
  });

  it("keeps the default footnote for a project without a budget", () => {
    setup({ budget: null });

    expect(screen.getByText(/Running deployments keep their funding unless top-ups stop at the budget\./)).toBeInTheDocument();
  });

  function setup(input: {
    budget?: ProjectBudget | null;
    spend?: ProjectSpend | null;
    organizationRole?: OrganizationRole;
    projectRole?: ProjectRole;
    grantHolderId?: string;
    isReadingBudget?: boolean;
    isSpendError?: boolean;
  }) {
    const report: ProjectSpendReport = {
      startDate: "2026-03-01",
      endDate: "2026-03-15",
      isEstimated: false,
      projects: input.spend === null ? [] : [input.spend ?? spend({})],
      unassigned: null,
      total: null
    };
    const useProjectMembersQuery = vi.fn<typeof DEPENDENCIES.useProjectMembersQuery>(() =>
      mock<ReturnType<typeof DEPENDENCIES.useProjectMembersQuery>>({
        data: input.projectRole
          ? [
              {
                id: "grant-1",
                projectId: "storefront",
                userId: input.grantHolderId ?? "user-1",
                username: "lena",
                email: null,
                role: input.projectRole,
                createdAt: ""
              }
            ]
          : []
      })
    );
    const useProjectBudgetQuery = vi.fn<typeof DEPENDENCIES.useProjectBudgetQuery>(() =>
      input.isReadingBudget
        ? mock<ReturnType<typeof DEPENDENCIES.useProjectBudgetQuery>>({ data: undefined, isLoading: true })
        : mock<ReturnType<typeof DEPENDENCIES.useProjectBudgetQuery>>({ data: input.budget === undefined ? budget({}) : input.budget, isLoading: false })
    );
    const useProjectSpendQuery = vi.fn<typeof DEPENDENCIES.useProjectSpendQuery>(() =>
      mock<ReturnType<typeof DEPENDENCIES.useProjectSpendQuery>>({
        data: input.isSpendError ? undefined : report,
        isLoading: false,
        isError: input.isSpendError ?? false
      })
    );
    const ProjectBudgetDialog = vi.fn<typeof DEPENDENCIES.ProjectBudgetDialog>(({ onClose }) => (
      <button type="button" onClick={onClose}>
        close editor
      </button>
    ));
    const dependencies = MockComponents(DEPENDENCIES, {
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
          activeOrganization: {
            id: "org-1",
            name: "Acme Corp",
            slug: "acme-corp",
            type: "team",
            role: input.organizationRole ?? "owner",
            isActive: true,
            createdAt: ""
          }
        }),
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: { id: "user-1" } }),
      useProjectMembersQuery,
      useProjectBudgetQuery,
      useProjectSpendQuery,
      ProjectBudgetDialog
    });

    render(<ProjectBudgetPanel projectId="storefront" projectName="storefront" dependencies={dependencies} />);

    return { useProjectMembersQuery, useProjectBudgetQuery, useProjectSpendQuery, ProjectBudgetDialog };
  }

  function budget({ committedUsd = 120, stopTopUps = false }: { committedUsd?: number; stopTopUps?: boolean }): ProjectBudget {
    return {
      id: "budget-1",
      projectId: "storefront",
      monthlyAmountUsd: 500,
      alertThresholdPercent: 80,
      stopTopUps,
      currentPeriod: { startDate: "2026-03-01", endDate: "2026-03-31", committedUsd },
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z"
    };
  }

  function spend(amounts: Partial<Pick<ProjectSpend, "committedUsd" | "consumedUsd" | "estimatedConsumedUsd">>): ProjectSpend {
    return {
      projectId: "storefront",
      name: "storefront",
      isDefault: false,
      isDeleted: false,
      committedUsd: 120,
      consumedUsd: 60,
      estimatedConsumedUsd: 0,
      ...amounts
    };
  }
});
