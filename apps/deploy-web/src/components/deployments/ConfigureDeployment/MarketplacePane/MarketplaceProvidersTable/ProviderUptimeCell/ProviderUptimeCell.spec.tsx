import { IntlProvider } from "react-intl";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it } from "vitest";

import type { BucketStatus, DayBucket, ProviderUptime } from "./deriveProviderUptime";
import { ProviderUptimeCell } from "./ProviderUptimeCell";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("ProviderUptimeCell", () => {
  it("renders one bar per bucket, colored and sized by status", () => {
    setup({ buckets: [bucket({ status: "online" }), bucket({ status: "partial" }), bucket({ status: "offline" })] });

    const bars = screen.getAllByTestId("uptime-bar");
    expect(bars).toHaveLength(3);
    expect(bars[0]).toHaveClass("bg-emerald-500", "h-4");
    expect(bars[1]).toHaveClass("bg-amber-500", "h-2.5");
    expect(bars[2]).toHaveClass("bg-rose-500", "h-1");
  });

  it("renders a live-down bucket as full-height red regardless of the offline height", () => {
    setup({ buckets: [bucket({ status: "offline", isLiveDown: true })] });

    const bar = screen.getByTestId("uptime-bar");
    expect(bar).toHaveClass("bg-rose-500", "h-4");
    expect(bar).not.toHaveClass("h-1");
  });

  it("colors the percentage by uptime tier", () => {
    setup({ percent: 0.9997, buckets: [] });
    expect(screen.getByText("99.97%")).toHaveClass("text-emerald-500");
  });

  it("colors the percentage amber between 95% and 99%", () => {
    setup({ percent: 0.97, buckets: [] });
    expect(screen.getByText("97%")).toHaveClass("text-amber-500");
  });

  it("colors the percentage rose below 95%", () => {
    setup({ percent: 0.9, buckets: [] });
    expect(screen.getByText("90%")).toHaveClass("text-rose-500");
  });

  it("shows the day's incident count and downtime in a tooltip on hover", async () => {
    setup({ buckets: [bucket({ date: "2026-06-12", status: "offline", incidentCount: 2, downtimeSeconds: 3 * 3600 + 12 * 60 })] });

    await userEvent.hover(screen.getByTestId("uptime-bar"));

    expect(await screen.findAllByText("Jun 12 — 2 incidents, 3h 12m down")).not.toHaveLength(0);
  });

  it("floors downtime minutes so it never renders an impossible 60-minute value", async () => {
    setup({ buckets: [bucket({ date: "2026-06-12", status: "offline", incidentCount: 1, downtimeSeconds: 3600 + 3570 })] });

    await userEvent.hover(screen.getByTestId("uptime-bar"));

    expect(await screen.findAllByText("Jun 12 — 1 incident, 1h 59m down")).not.toHaveLength(0);
  });

  it("lists every day's stats in a single tooltip on hover", async () => {
    setup({
      buckets: [
        bucket({ date: "2026-06-10", status: "online" }),
        bucket({ date: "2026-06-11", status: "partial", incidentCount: 1, downtimeSeconds: 600 }),
        bucket({ date: "2026-06-12", status: "offline", incidentCount: 2, downtimeSeconds: 3 * 3600 + 12 * 60 })
      ]
    });

    await userEvent.hover(screen.getAllByTestId("uptime-bar")[0]);

    expect(await screen.findAllByText("Jun 10 — no incidents")).not.toHaveLength(0);
    expect(screen.getAllByText("Jun 11 — 1 incident, 10m down")).not.toHaveLength(0);
    expect(screen.getAllByText("Jun 12 — 2 incidents, 3h 12m down")).not.toHaveLength(0);
  });

  it("labels a live-down day as currently down in the tooltip", async () => {
    setup({ buckets: [bucket({ date: "2026-06-15", status: "offline", incidentCount: 1, downtimeSeconds: 60, isLiveDown: true })] });

    await userEvent.hover(screen.getByTestId("uptime-bar"));

    expect(await screen.findAllByText(/Jun 15 — currently down/)).not.toHaveLength(0);
  });

  function bucket(overrides: Partial<DayBucket> & { status: BucketStatus }): DayBucket {
    return { date: "2026-06-10", incidentCount: 0, downtimeSeconds: 0, isLiveDown: false, ...overrides };
  }

  function setup(input: Partial<ProviderUptime> & { buckets: DayBucket[] }) {
    render(
      <IntlProvider locale="en">
        <TooltipProvider delayDuration={0}>
          <ProviderUptimeCell uptime={{ percent: input.percent ?? 1, buckets: input.buckets }} />
        </TooltipProvider>
      </IntlProvider>
    );
    return input;
  }
});
