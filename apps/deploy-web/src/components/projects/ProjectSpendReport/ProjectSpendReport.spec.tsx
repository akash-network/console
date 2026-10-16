import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProjectSpend, ProjectSpendReport as SpendReport, SpendAmounts, SpendRange } from "@src/types/project-budget";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./ProjectSpendReport";
import { ProjectSpendReport } from "./ProjectSpendReport";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProjectSpendReport.name, () => {
  it("reports each project with the unassigned remainder and the organization total", () => {
    setup({
      report: report({
        projects: [projectSpend("storefront", { committedUsd: 300, consumedUsd: 120.5 }), projectSpend("marketing", { committedUsd: 50, consumedUsd: 20 })],
        unassigned: amounts({ committedUsd: 10, consumedUsd: 4 }),
        total: amounts({ committedUsd: 360, consumedUsd: 144.5 })
      })
    });

    expect(rowTexts()).toEqual([
      ["storefront", "$300.00", "$120.50"],
      ["marketing", "$50.00", "$20.00"],
      ["Unassigned", "$10.00", "$4.00"],
      ["Total", "$360.00", "$144.50"]
    ]);
    expect(screen.getByRole("link", { name: "storefront" })).toHaveAttribute("href", UrlService.project("storefront"));
    expect(screen.queryByText("Showing only the projects you can open.")).not.toBeInTheDocument();
  });

  it("shows a caller limited to some projects only those, without totals", () => {
    setup({ report: report({ projects: [projectSpend("storefront", {})], unassigned: null, total: null }) });

    expect(rowTexts().map(([label]) => label)).toEqual(["storefront"]);
    expect(screen.getByText("Showing only the projects you can open.")).toBeInTheDocument();
  });

  it("names a deleted project without linking to it", () => {
    setup({ report: report({ projects: [projectSpend("old-api", { isDeleted: true })] }) });

    expect(screen.getByText("old-api (deleted)")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /old-api/ })).not.toBeInTheDocument();
  });

  it("marks the report as estimated while some consumption is not settled", () => {
    setup({ report: report({ isEstimated: true }) });

    expect(screen.getByText("Estimated")).toBeInTheDocument();
    expect(screen.getByText("Consumed includes lease costs the chain hasn't settled yet.")).toBeInTheDocument();
  });

  it("leaves the estimate marker off a settled report", () => {
    setup({ report: report({ isEstimated: false }) });

    expect(screen.queryByText("Estimated")).not.toBeInTheDocument();
  });

  it("states the dates the report covers", () => {
    setup({ report: report({}) });

    expect(screen.getByText("2026-03-01 to 2026-03-15, UTC")).toBeInTheDocument();
  });

  it("reads the spend of the range it is given", () => {
    const { useProjectSpendQuery } = setup({ report: report({}), range: { startDate: "2026-02-14", endDate: "2026-03-15" } });

    expect(useProjectSpendQuery).toHaveBeenLastCalledWith({ startDate: "2026-02-14", endDate: "2026-03-15" });
  });

  it("says when the caller has no project to report", () => {
    setup({ report: report({ projects: [], unassigned: null, total: null }) });

    expect(screen.getByText("No projects to show.")).toBeInTheDocument();
  });

  it("says it is loading until the report arrives", () => {
    setup({ report: undefined });

    expect(screen.getByText("Loading spend…")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers to retry when the report cannot be loaded", async () => {
    const { refetch } = setup({ report: undefined, isError: true });

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Couldn't load spend.")).toBeInTheDocument();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  function setup(input: { report: SpendReport | undefined; isError?: boolean; range?: SpendRange }) {
    const refetch = vi.fn();
    const useProjectSpendQuery = vi.fn<typeof DEPENDENCIES.useProjectSpendQuery>(() =>
      mock<ReturnType<typeof DEPENDENCIES.useProjectSpendQuery>>({ data: input.report, isError: input.isError ?? false, refetch })
    );

    render(<ProjectSpendReport range={input.range ?? { startDate: "2026-03-01", endDate: "2026-03-15" }} dependencies={{ useProjectSpendQuery }} />);

    return { useProjectSpendQuery, refetch };
  }

  function rowTexts() {
    const [, body] = within(screen.getByRole("table", { name: "Spend per project" })).getAllByRole("rowgroup");
    return within(body)
      .getAllByRole("row")
      .map(row => [
        within(row).getByRole("rowheader").textContent,
        ...within(row)
          .getAllByRole("cell")
          .map(cell => cell.textContent)
      ]);
  }

  function report(overrides: Partial<SpendReport>): SpendReport {
    return {
      startDate: "2026-03-01",
      endDate: "2026-03-15",
      isEstimated: false,
      projects: [projectSpend("storefront", {})],
      unassigned: amounts({}),
      total: amounts({}),
      ...overrides
    };
  }

  function projectSpend(name: string, overrides: Partial<ProjectSpend>): ProjectSpend {
    return { projectId: name, name, isDefault: false, isDeleted: false, ...amounts({}), ...overrides };
  }

  function amounts(overrides: Partial<SpendAmounts>): SpendAmounts {
    return { committedUsd: 0, consumedUsd: 0, estimatedConsumedUsd: 0, ...overrides };
  }
});
