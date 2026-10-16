import React from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";

import type { ProjectSpendRow } from "@src/components/billing-usage/UsageContainer/teamUsage";
import type { ProjectSpendListProps } from "./ProjectSpendList";
import { ProjectSpendList } from "./ProjectSpendList";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProjectSpendList.name, () => {
  it("heads the list with the range on screen", () => {
    setup({ rangeLabel: "Last 7 days" });

    expect(within(screen.getByRole("region", { name: "Spend by project" })).getByText("Last 7 days")).toBeInTheDocument();
  });

  it("shows each project's deployments, hours, consumed and committed spend and share", () => {
    setup({
      rows: [buildRow({ label: "Storefront", deploymentCount: 3, hours: 71.6, consumedUsd: 11.9, committedUsd: 20, sharePercent: 62.345 })]
    });

    const row = screen.getByRole("button", { name: /Storefront/ });
    expect(row).toHaveTextContent("3 deployments · 72 hrs");
    expect(within(row).getByText("$11.90")).toBeInTheDocument();
    expect(row).toHaveTextContent("$20.00 committed");
    expect(within(row).getByText("62.3%")).toBeInTheDocument();
    expect(row).toHaveAttribute("data-idle", "false");
  });

  it("counts a single deployment in the singular", () => {
    setup({ rows: [buildRow({ deploymentCount: 1, hours: 2 })] });

    expect(screen.getByRole("listitem")).toHaveTextContent("1 deployment · 2 hrs");
  });

  it("draws each project's share as the width of its bar", () => {
    setup({ rows: [buildRow({ sharePercent: 40 })] });

    expect(screen.getByRole("listitem").querySelector("[aria-hidden] > span")).toHaveStyle({ width: "40%" });
  });

  it("narrows the page to the project picked", async () => {
    const onSelect = vi.fn();
    setup({ rows: [buildRow({ label: "Storefront", onSelect })] });

    await userEvent.click(screen.getByRole("button", { name: /Storefront/ }));

    expect(onSelect).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Storefront/ })).toHaveAttribute("title", "Show only Storefront");
  });

  it("offers no way to narrow to a row that can't be picked", () => {
    setup({ rows: [buildRow({ label: "Unassigned", onSelect: undefined })] });

    expect(screen.getByRole("listitem")).toHaveTextContent("Unassigned");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("marks a project that consumed nothing and leaves its committed line out when nothing was committed", () => {
    setup({ rows: [buildRow({ consumedUsd: 0, committedUsd: 0, sharePercent: 0, shade: null })] });

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Nothing ran in this range");
    expect(row).not.toHaveTextContent("committed");
    expect(within(row).getByRole("button")).toHaveAttribute("data-idle", "true");
  });

  it("marks a row that can't be picked as idle once it consumed nothing", () => {
    setup({ rows: [buildRow({ consumedUsd: 0, onSelect: undefined })] });

    expect(screen.getByRole("listitem").firstElementChild).toHaveAttribute("data-idle", "true");
  });

  it("explains that consumption includes unsettled lease costs while it is estimated", () => {
    setup({ rows: [buildRow()], isEstimated: true });

    expect(screen.getByText("Estimated")).toBeInTheDocument();
    expect(screen.getByText("Includes lease costs the chain hasn't settled yet.")).toBeInTheDocument();
  });

  it("tells a caller limited to some projects that the list is partial", () => {
    setup({ rows: [buildRow()], isPartial: true });

    expect(screen.getByText("Showing only the projects you can open.")).toBeInTheDocument();
    expect(screen.queryByText("Estimated")).not.toBeInTheDocument();
  });

  it("adds no note under a settled list of every project", () => {
    setup({ rows: [buildRow()] });

    expect(screen.queryByText("Estimated")).not.toBeInTheDocument();
    expect(screen.queryByText("Showing only the projects you can open.")).not.toBeInTheDocument();
  });

  it("holds the rows back while the spend loads", () => {
    setup({ rows: [buildRow()], isLoading: true });

    expect(screen.getByRole("region").querySelector("[aria-busy='true']")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("explains a failed load in place of the rows", () => {
    setup({ rows: [buildRow()], isError: true });

    expect(screen.getByText("Spend by project couldn't be loaded. Refresh the page to try again.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("says so when there is no project to show", () => {
    setup({ rows: [] });

    expect(screen.getByText("No projects to show")).toBeInTheDocument();
  });

  function setup(input: Partial<ProjectSpendListProps>) {
    render(
      <IntlProvider locale="en-US">
        <ProjectSpendList
          rows={input.rows ?? []}
          isEstimated={input.isEstimated ?? false}
          isPartial={input.isPartial ?? false}
          isLoading={input.isLoading ?? false}
          isError={input.isError ?? false}
          rangeLabel={input.rangeLabel ?? "Last 30 days"}
        />
      </IntlProvider>
    );
  }

  function buildRow(overrides: Partial<ProjectSpendRow> = {}): ProjectSpendRow {
    return {
      key: "storefront",
      label: "Storefront",
      onSelect: vi.fn(),
      deploymentCount: 2,
      hours: 10,
      consumedUsd: 1,
      committedUsd: 0,
      sharePercent: 100,
      shade: "black",
      ...overrides
    };
  }
});
