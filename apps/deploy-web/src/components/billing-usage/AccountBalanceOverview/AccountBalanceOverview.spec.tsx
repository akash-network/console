import { describe, expect, it, vi } from "vitest";

import { AccountBalanceOverview, DEPENDENCIES } from "./AccountBalanceOverview";
import type { AccountBalanceOverview as AccountBalanceOverviewData } from "./useAccountBalanceOverview";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AccountBalanceOverview.name, () => {
  it("renders the total account balance", () => {
    setup({ totalUsd: 3211.2 });

    expect(screen.getByLabelText("Total account balance")).toHaveTextContent("3211.2");
  });

  it("shows the runway badge and lasts-until date while spending", () => {
    setup({ runwayDays: 12, perHour: 11.15, lastsUntil: new Date(2026, 7, 23) });

    expect(screen.getByText("12 days of runway")).toBeInTheDocument();
    expect(screen.getByText(/lasts until/)).toHaveTextContent("Aug 23");
  });

  it("hides the runway indicator when nothing is being spent", () => {
    setup({ runwayDays: null, lastsUntil: null });

    expect(screen.queryByText(/of runway/)).not.toBeInTheDocument();
    expect(screen.queryByText(/lasts until/)).not.toBeInTheDocument();
  });

  it("explains reserved funds with the running deployment count", () => {
    setup({ reserved: 1338, available: 1873.2, activeDeploymentCount: 7 });

    expect(screen.getByText(/is reserved to keep your 7 running deployments online/)).toBeInTheDocument();
    expect(screen.getByText(/is available for new deployments/)).toBeInTheDocument();
  });

  it("omits the reserved sentence when nothing is reserved", () => {
    setup({ reserved: 0, available: 500 });

    expect(screen.queryByText(/is reserved to keep/)).not.toBeInTheDocument();
    expect(screen.getByText(/is available for new deployments/)).toBeInTheDocument();
  });

  it("lists each deployment and the available balance in the legend", () => {
    setup({ deployments: [{ dseq: "1", name: "llama-chat", reservedUsd: 508.8 }], available: 1873.2 });

    expect(screen.getByText("llama-chat")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("reassures when auto recharge is on", () => {
    setup({ autoReloadEnabled: true });

    expect(screen.getByText(/Auto Recharge is on/)).toBeInTheDocument();
  });

  it("stays quiet about auto recharge when it is off", () => {
    setup({ autoReloadEnabled: false });

    expect(screen.queryByText(/Auto Recharge is on/)).not.toBeInTheDocument();
  });

  it("renders a skeleton instead of balance while loading", () => {
    setup({ isLoading: true });

    expect(screen.queryByLabelText("Total account balance")).not.toBeInTheDocument();
  });

  function setup(overview: Partial<AccountBalanceOverviewData>) {
    const data: AccountBalanceOverviewData = {
      totalUsd: 0,
      reserved: 0,
      available: 0,
      deployments: [],
      activeDeploymentCount: 0,
      perHour: 0,
      perMonth: 0,
      lastsUntil: null,
      runwayDays: null,
      autoReloadEnabled: false,
      isLoading: false,
      ...overview
    };
    const MockFormattedNumber = vi.fn(({ value }: { value: number }) => <>{value}</>);

    return render(
      <AccountBalanceOverview
        dependencies={
          {
            ...MockComponents(DEPENDENCIES),
            useAccountBalanceOverview: () => data,
            FormattedNumber: MockFormattedNumber
          } as unknown as typeof DEPENDENCIES
        }
      />
    );
  }
});
