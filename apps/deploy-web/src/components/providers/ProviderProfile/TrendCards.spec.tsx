import { describe, expect, it } from "vitest";

import { buildSparkline, LeaseTrendCard, UptimeCard } from "./TrendCards";

import { render, screen, within } from "@testing-library/react";

describe("TrendCards", () => {
  describe("LeaseTrendCard", () => {
    it("shows the running leases, their growth over 30 days and their history", () => {
      render(<LeaseTrendCard trend={{ current: 28, changeOver30Days: 3, series: [20, 25, 28] }} />);

      expect(screen.getByText("28")).toBeInTheDocument();
      expect(screen.getByText("leases running · 3 days")).toBeInTheDocument();
      expect(screen.getByText("▲ 3 in 30d")).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Active leases over time" })).toBeInTheDocument();
      expect(screen.getByText("3d ago")).toBeInTheDocument();
    });

    it.each([
      { change: 3, badge: "▲ 3 in 30d", badgeTone: "text-emerald-700", chartTone: "text-emerald-500" },
      { change: 0, badge: "▲ 0 in 30d", badgeTone: "text-emerald-700", chartTone: "text-emerald-500" },
      { change: -2, badge: "▼ 2 in 30d", badgeTone: "text-amber-700", chartTone: "text-amber-500" }
    ])("shows a change of $change over 30 days as $badge in the $chartTone tone", ({ change, badge, badgeTone, chartTone }) => {
      render(<LeaseTrendCard trend={{ current: 28, changeOver30Days: change, series: [30, 28] }} />);

      expect(screen.getByText(badge)).toHaveClass(badgeTone);
      expect(screen.getByRole("img", { name: "Active leases over time" })).toHaveClass(chartTone);
    });

    it("leaves the 30-day change out when it isn't known and draws the history as growing", () => {
      render(<LeaseTrendCard trend={{ current: 5, changeOver30Days: null, series: [5, 5] }} />);

      expect(screen.queryByText(/in 30d/)).not.toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Active leases over time" })).toHaveClass("text-emerald-500");
    });

    it("draws the chart from two days of history", () => {
      render(<LeaseTrendCard trend={{ current: 5, changeOver30Days: null, series: [4, 5] }} />);

      expect(screen.getByRole("img", { name: "Active leases over time" })).toBeInTheDocument();
      expect(screen.queryByText("Not enough history to draw yet.")).not.toBeInTheDocument();
    });

    it("draws no chart from a single day", () => {
      render(<LeaseTrendCard trend={{ current: 5, changeOver30Days: null, series: [5] }} />);

      expect(screen.getByText("Not enough history to draw yet.")).toBeInTheDocument();
    });

    it("says when there is no lease history", () => {
      render(<LeaseTrendCard trend={null} />);

      expect(screen.getByText("No lease history yet.")).toBeInTheDocument();
    });
  });

  describe(buildSparkline.name, () => {
    it("spreads the days across the width and scales the values to the height with some headroom", () => {
      expect(buildSparkline([20, 25, 28])).toEqual({
        line: "M0.00,28.69L50.00,14.90L100.00,6.63",
        area: "M0.00,28.69L50.00,14.90L100.00,6.63L100,34L0,34Z"
      });
    });

    it("draws a flat line along the bottom when there were no leases", () => {
      expect(buildSparkline([0, 0, 0])).toEqual({
        line: "M0.00,32.00L50.00,32.00L100.00,32.00",
        area: "M0.00,32.00L50.00,32.00L100.00,32.00L100,34L0,34Z"
      });
    });
  });

  describe("UptimeCard", () => {
    it("shows the uptime over 30 days, 7 days and 24 hours", () => {
      render(<UptimeCard provider={{ uptime30d: 0.9995, uptime7d: 0.99, uptime1d: 1, uptime: [] }} />);

      expect(screen.getByText("99.95%")).toBeInTheDocument();
      expect(screen.getByText("30 days · 7d 99% · 24h 100%")).toBeInTheDocument();
    });

    it("groups the last day's checks into 15-minute periods, flagging partial and failed ones", () => {
      render(
        <UptimeCard
          provider={{
            uptime30d: 0.9,
            uptime7d: 0.9,
            uptime1d: 0.5,
            uptime: [
              { id: "3", isOnline: false, checkDate: localTime(10, 20) },
              { id: "1", isOnline: true, checkDate: localTime(10, 0) },
              { id: "2", isOnline: true, checkDate: localTime(10, 5) },
              { id: "4", isOnline: true, checkDate: localTime(10, 25) },
              { id: "5", isOnline: false, checkDate: localTime(10, 40) }
            ]
          }}
        />
      );

      const [online, partial, offline] = within(screen.getByRole("list", { name: "Checks over the last 24 hours" })).getAllByRole("listitem");
      expect(online).toHaveAccessibleName("10:00 online");
      expect(online).toHaveAttribute("title", "Oct 4, 10:00 · online");
      expect(online).toHaveClass("bg-emerald-500/85");
      expect(partial).toHaveAccessibleName("10:20 partial");
      expect(partial).toHaveClass("bg-amber-500");
      expect(offline).toHaveAccessibleName("10:40 offline");
      expect(offline).toHaveClass("bg-red-500");
      expect(screen.getByText("24h ago")).toBeInTheDocument();
      expect(screen.queryByText("No checks in the last 24 hours.")).not.toBeInTheDocument();
    });

    it("starts a new period once 15 minutes have passed since the period began", () => {
      render(
        <UptimeCard
          provider={{
            uptime30d: 0.9,
            uptime7d: 0.9,
            uptime1d: 0.5,
            uptime: [
              { id: "1", isOnline: true, checkDate: localTime(10, 0) },
              { id: "2", isOnline: false, checkDate: localTime(10, 15) }
            ]
          }}
        />
      );

      const periods = within(screen.getByRole("list", { name: "Checks over the last 24 hours" })).getAllByRole("listitem");
      expect(periods.map(period => period.getAttribute("aria-label"))).toEqual(["10:00 online", "10:15 offline"]);
    });

    it("says when no check ran in the last day and an uptime isn't measured", () => {
      render(<UptimeCard provider={{ uptime30d: null, uptime7d: 0.5, uptime1d: 0.5, uptime: [] }} />);

      expect(screen.getByText("No checks in the last 24 hours.")).toBeInTheDocument();
      expect(screen.getByText("—")).toHaveClass("text-foreground");
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
      expect(screen.queryByText("24h ago")).not.toBeInTheDocument();
    });
  });

  function localTime(hours: number, minutes: number) {
    return new Date(2026, 9, 4, hours, minutes).toISOString();
  }
});
