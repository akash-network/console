import { describe, expect, it } from "vitest";

import { LeaseTrendCard, UptimeCard } from "./TrendCards";

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

    it("shows a decline over 30 days", () => {
      render(<LeaseTrendCard trend={{ current: 28, changeOver30Days: -2, series: [30, 28] }} />);

      expect(screen.getByText("▼ 2 in 30d")).toBeInTheDocument();
    });

    it("leaves the 30-day change out when it isn't known", () => {
      render(<LeaseTrendCard trend={{ current: 5, changeOver30Days: null, series: [5, 5] }} />);

      expect(screen.queryByText(/in 30d/)).not.toBeInTheDocument();
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
              { id: "3", isOnline: false, checkDate: "2026-10-04T10:20:00.000Z" },
              { id: "1", isOnline: true, checkDate: "2026-10-04T10:00:00.000Z" },
              { id: "2", isOnline: true, checkDate: "2026-10-04T10:05:00.000Z" },
              { id: "4", isOnline: true, checkDate: "2026-10-04T10:25:00.000Z" },
              { id: "5", isOnline: false, checkDate: "2026-10-04T10:40:00.000Z" }
            ]
          }}
        />
      );

      const periods = within(screen.getByRole("list", { name: "Checks over the last 24 hours" })).getAllByRole("listitem");
      expect(periods.map(period => period.getAttribute("aria-label")?.split(" ")[1])).toEqual(["online", "partial", "offline"]);
    });

    it("says when no check ran in the last day and an uptime isn't measured", () => {
      render(<UptimeCard provider={{ uptime30d: null, uptime7d: 0.5, uptime1d: 0.5, uptime: [] }} />);

      expect(screen.getByText("No checks in the last 24 hours.")).toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });
});
