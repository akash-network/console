import { type ComponentPropsWithoutRef, forwardRef, type ReactElement } from "react";
import type { BarChart } from "recharts";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TemplateInsights, TemplateInsightTotals } from "@src/types/marketplace-template";
import { DayTooltip, DEPENDENCIES, TemplateInsightsTab } from "./TemplateInsightsTab";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

type InsightsQuery = ReturnType<typeof DEPENDENCIES.useTemplateInsights>;

describe(TemplateInsightsTab.name, () => {
  it("asks for the last 30 days at first, and for the period picked", async () => {
    const { useTemplateInsights } = setup({ insights: buildInsights() });
    expect(useTemplateInsights).toHaveBeenLastCalledWith("tpl-1", 30, { enabled: true });

    await userEvent.click(screen.getByRole("radio", { name: "Last 7 days" }));
    expect(useTemplateInsights).toHaveBeenLastCalledWith("tpl-1", 7, { enabled: true });

    await userEvent.click(screen.getByRole("radio", { name: "Last 90 days" }));
    expect(useTemplateInsights).toHaveBeenLastCalledWith("tpl-1", 90, { enabled: true });
    expect(screen.getByRole("radio", { name: "Last 90 days" })).toBeChecked();
  });

  it("waits while the insights load", () => {
    setup({ state: "loading" });

    expect(screen.getByRole("status", { name: "Loading insights" })).toBeInTheDocument();
  });

  it("says the insights could not be loaded", () => {
    setup({ state: "failed" });

    expect(screen.getByText("Insights couldn't be loaded. Refresh the page to try again.")).toBeInTheDocument();
  });

  it("explains a template nobody used yet instead of showing zeros", () => {
    const { ChartContainer } = setup({ insights: buildInsights({ days: 7 }) });

    expect(screen.getByText("Nobody has viewed or deployed this template in the last 7 days. Numbers show up here once people use it.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Views" })).not.toBeInTheDocument();
    expect(ChartContainer).not.toHaveBeenCalled();
  });

  it("shows the numbers of a template used only in the period before", () => {
    setup({ insights: buildInsights({ previous: totals({ deploys: 3 }) }) });

    expect(within(screen.getByRole("group", { name: "Deploys" })).getByText("−100% vs the previous 30 days")).toBeInTheDocument();
  });

  it("counts the period with its change against the one before", () => {
    setup({ insights: buildInsights({ current: totals({ views: 1200, configureOpens: 40, deploys: 6, forks: 2 }), previous: totals({ views: 800, deploys: 6 }) }) });

    expect(within(screen.getByRole("group", { name: "Views" })).getByText("1,200")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Views" })).getByText("+50% vs the previous 30 days")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Configure opens" })).getByText("None in the previous 30 days")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Deploys" })).getByText("Same as the previous 30 days")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Forks" })).getByText("2")).toBeInTheDocument();
  });

  it("walks from view to running deployment with each step's share", () => {
    setup({
      insights: buildInsights({
        current: totals({ views: 200, configureOpens: 50, deploys: 10, leases: 8, decidedLeases: 6, stillRunning: 3, leaseRate: 0.8, stillRunningRate: 0.5 })
      })
    });

    const funnel = within(screen.getByRole("list"));
    expect(funnel.getByText("25% of the step before")).toBeInTheDocument();
    expect(funnel.getByText("20% of the step before")).toBeInTheDocument();
    expect(funnel.getByText("80% of deployments")).toBeInTheDocument();
    expect(funnel.getByText("50% of the 6 followed for a day")).toBeInTheDocument();
  });

  it("says when too few deployments are behind a rate", () => {
    setup({ insights: buildInsights({ current: totals({ deploys: 2, leases: 1 }) }) });

    const funnel = within(screen.getByRole("list"));
    expect(funnel.getByText("Too few deployments to tell")).toBeInTheDocument();
    expect(funnel.getByText("Too few deployments followed for a day to tell")).toBeInTheDocument();
    expect(funnel.queryByText(/of the step before/)).not.toBeInTheDocument();
  });

  it("lists the hints with their tone for screen readers", () => {
    setup({
      insights: buildInsights({
        current: totals({ deploys: 20 }),
        hints: [
          { kind: "few_get_a_provider", tone: "warning", value: 0.4, previousValue: null, version: null },
          { kind: "few_viewers_deploy", tone: "info", value: 0.01, previousValue: null, version: null },
          { kind: "deploys_growing", tone: "positive", value: 20, previousValue: 5, version: null }
        ]
      })
    });

    const hints = within(screen.getByRole("region", { name: "Suggestions" }));
    expect(hints.getByText("Needs attention:")).toBeInTheDocument();
    expect(hints.getByText("Many deployments don't get a provider")).toBeInTheDocument();
    expect(hints.getByText("Suggestion:")).toBeInTheDocument();
    expect(hints.getByText("Going well:")).toBeInTheDocument();
  });

  it("shows neither suggestions nor a version table while there are none", () => {
    setup({ insights: buildInsights({ current: totals({ views: 3 }) }) });

    expect(screen.queryByRole("region", { name: "Suggestions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("compares the versions, newest first, with a dash where too few deployed it", () => {
    setup({
      insights: buildInsights({
        current: totals({ deploys: 4 }),
        versions: [
          { version: 1, deploys: 12, leases: 9, decidedLeases: 9, stillRunning: 8, leaseRate: 0.75, stillRunningRate: 0.889 },
          { version: 2, deploys: 3, leases: 3, decidedLeases: 1, stillRunning: 1, leaseRate: null, stillRunningRate: null }
        ]
      })
    });

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows.slice(1).map(row => row.textContent)).toEqual(["v23——", "v11275%89%"]);
  });

  it("charts views by day at first, and the measure picked", async () => {
    const { chartData } = setup({
      insights: buildInsights({
        current: totals({ views: 5, deploys: 2 }),
        daily: [day("2026-11-26", { views: 3 }), day("2026-11-27", { views: 2, deploys: 2 })]
      })
    });
    expect(chartData()).toEqual([
      { day: "2026-11-26", value: 3 },
      { day: "2026-11-27", value: 2 }
    ]);
    expect(screen.getByText("Views by day")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Deploys" }));

    expect(screen.getByText("Deploys by day")).toBeInTheDocument();
    expect(chartData()).toEqual([
      { day: "2026-11-26", value: 0 },
      { day: "2026-11-27", value: 2 }
    ]);
  });

  it("says so instead of charting a measure that stayed at zero", async () => {
    const { ChartContainer } = setup({
      insights: buildInsights({ current: totals({ views: 3 }), daily: [day("2026-11-26", { views: 3 }), day("2026-11-27")] })
    });
    ChartContainer.mockClear();

    await userEvent.click(screen.getByRole("radio", { name: "Configure opens" }));

    expect(screen.getByText("No configure opens in this period")).toBeInTheDocument();
    expect(ChartContainer).not.toHaveBeenCalled();
  });

  it.each([
    [true, "Counted on mainnet. Views count signed-in people once a day. Your organization's own views and deployments don't count."],
    [false, "Counted on mainnet. Views count signed-in people once a day."]
  ])("explains what is counted when the template is public: %s", (isPublic, text) => {
    setup({ insights: buildInsights(), isPublic });

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  describe(DayTooltip.name, () => {
    it("names the day and the measure", () => {
      render(<DayTooltip active payload={[{ payload: { day: "2026-11-27", value: 1500 } }]} measure="Views" />);

      expect(screen.getByText("Nov 27")).toBeInTheDocument();
      expect(screen.getByText("1,500")).toBeInTheDocument();
    });

    it.each([
      [false, [{ payload: { day: "2026-11-27", value: 1 } }]],
      [true, []]
    ])("shows nothing while no bar is hovered (active: %s)", (active, payload) => {
      const { container } = render(<DayTooltip active={active} payload={payload} measure="Views" />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  function day(date: string, counts: Partial<TemplateInsights["daily"][number]> = {}): TemplateInsights["daily"][number] {
    return { day: date, views: 0, configureOpens: 0, deploys: 0, leases: 0, stillRunning: 0, ...counts };
  }

  function totals(overrides: Partial<TemplateInsightTotals> = {}): TemplateInsightTotals {
    return {
      views: 0,
      configureOpens: 0,
      deploys: 0,
      leases: 0,
      decidedLeases: 0,
      stillRunning: 0,
      forks: 0,
      leaseRate: null,
      stillRunningRate: null,
      viewToDeployRate: null,
      ...overrides
    };
  }

  function buildInsights(overrides: Partial<TemplateInsights> = {}): TemplateInsights {
    return {
      days: 30,
      from: "2026-10-29",
      to: "2026-11-27",
      current: totals(),
      previous: totals(),
      daily: [day("2026-10-29"), day("2026-11-27")],
      versions: [],
      hints: [],
      ...overrides
    };
  }

  function queryOf(input: { insights?: TemplateInsights; state?: "loading" | "failed" }): InsightsQuery {
    if (input.state === "failed") return mock<InsightsQuery>({ data: undefined, isError: true, isLoading: false });
    if (input.state === "loading" || !input.insights) return mock<InsightsQuery>({ data: undefined, isError: false, isLoading: true });

    return mock<InsightsQuery>({ data: input.insights, isError: false, isLoading: false });
  }

  function setup(input: { insights?: TemplateInsights; state?: "loading" | "failed"; isPublic?: boolean }) {
    const query = queryOf(input);
    const useTemplateInsights = vi.fn<typeof DEPENDENCIES.useTemplateInsights>(() => query);
    const ChartContainer = vi.fn((_props: ComponentPropsWithoutRef<typeof DEPENDENCIES.ChartContainer>) => null);
    const ForwardedChartContainer = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DEPENDENCIES.ChartContainer>>(props => ChartContainer(props));
    const dependencies = MockComponents(DEPENDENCIES, { useTemplateInsights, ChartContainer: ForwardedChartContainer });
    const chartData = () => (ChartContainer.mock.lastCall![0].children as ReactElement<ComponentPropsWithoutRef<typeof BarChart>>).props.data;

    render(<TemplateInsightsTab templateId="tpl-1" isPublic={input.isPublic ?? true} dependencies={dependencies} />);

    return { useTemplateInsights, ChartContainer, chartData };
  }
});
