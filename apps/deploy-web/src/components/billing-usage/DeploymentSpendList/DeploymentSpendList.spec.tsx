import React from "react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";

import type { DeploymentSpendRow } from "@src/components/billing-usage/UsageContainer/teamUsage";
import type { DeploymentSpendListProps } from "./DeploymentSpendList";
import { DeploymentSpendList } from "./DeploymentSpendList";

import { render, screen, within } from "@testing-library/react";

describe(DeploymentSpendList.name, () => {
  it("heads the list with its title and range", () => {
    setup({ title: "Spend by deployment · Storefront", rangeLabel: "Last 7 days" });

    const section = screen.getByRole("region", { name: "Spend by deployment · Storefront" });
    expect(within(section).getByText("Spend by deployment · Storefront")).toBeInTheDocument();
    expect(within(section).getByText("Last 7 days")).toBeInTheDocument();
  });

  it("shows each deployment's project, hours, hourly rate, spend and share", () => {
    setup({ rows: [buildRow({ projectName: "Storefront", hours: 47.6, hourlyRateUsd: 0.25, consumedUsd: 11.9, sharePercent: 62.345 })] });

    const row = screen.getByRole("listitem");
    expect(within(row).getByRole("link", { name: "web" })).toHaveAttribute("href", "/deployments/1");
    expect(row).toHaveTextContent("Storefront · 48 hrs · $0.25/hr");
    expect(within(row).getByText("$11.90")).toBeInTheDocument();
    expect(within(row).getByText("62.3%")).toBeInTheDocument();
  });

  it("shows the digits of an hourly rate under half a cent instead of $0.00/hr", () => {
    setup({ rows: [buildRow({ hours: 120, hourlyRateUsd: 0.00123, consumedUsd: 0.1476 })] });

    expect(screen.getByRole("listitem")).toHaveTextContent("120 hrs · $0.0012/hr");
  });

  it("draws each deployment's share as the width of its bar", () => {
    setup({ rows: [buildRow({ sharePercent: 40 })] });

    expect(screen.getByRole("listitem").querySelector("[aria-hidden] > div")).toHaveStyle({ width: "40%" });
  });

  it("names a deployment without a name by its dseq", () => {
    setup({ rows: [buildRow({ dseq: "8812", name: null })] });

    expect(screen.getByRole("link", { name: "DSEQ 8812" })).toHaveAttribute("href", "/deployments/8812");
  });

  it("leaves the project out while the page is narrowed to one", () => {
    setup({ rows: [buildRow({ projectName: "Storefront", hours: 3, hourlyRateUsd: 1 })], showsProject: false });

    expect(screen.getByRole("listitem")).toHaveTextContent("web3 hrs · $1.00/hr");
  });

  it("lists the deployments in the order given", () => {
    setup({ rows: [buildRow({ dseq: "1", name: "api" }), buildRow({ dseq: "2", name: "web" })] });

    expect(screen.getAllByRole("link").map(link => link.textContent)).toEqual(["api", "web"]);
  });

  it("holds the rows back while the spend loads", () => {
    setup({ rows: [buildRow()], isLoading: true });

    expect(screen.getByRole("region").querySelector("[aria-busy='true']")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("explains a failed load in place of the rows", () => {
    setup({ rows: [buildRow()], isError: true });

    expect(screen.getByText("Spend by deployment couldn't be loaded. Refresh the page to try again.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("says so when no deployment spent in the range", () => {
    setup({ rows: [] });

    expect(screen.getByText("No spend in this range")).toBeInTheDocument();
  });

  function setup(input: Partial<DeploymentSpendListProps>) {
    render(
      <IntlProvider locale="en-US">
        <DeploymentSpendList
          title={input.title ?? "Spend by deployment"}
          rows={input.rows ?? []}
          showsProject={input.showsProject ?? true}
          isLoading={input.isLoading ?? false}
          isError={input.isError ?? false}
          rangeLabel={input.rangeLabel ?? "Last 30 days"}
        />
      </IntlProvider>
    );
  }

  function buildRow(overrides: Partial<DeploymentSpendRow> = {}): DeploymentSpendRow {
    return { dseq: "1", name: "web", projectName: "Storefront", hours: 10, hourlyRateUsd: 0.1, consumedUsd: 1, sharePercent: 100, ...overrides };
  }
});
