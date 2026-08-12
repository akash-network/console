import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { UrlService } from "@src/utils/urlUtils";
import { AccountBalanceOverview, DEPENDENCIES } from "./AccountBalanceOverview";
import type { AccountBalanceOverview as AccountBalanceOverviewData } from "./useAccountBalanceOverview";

import { fireEvent, render, screen } from "@testing-library/react";
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

  it("shows the reserved and available balances with their descriptors", () => {
    setup({ reserved: 1338, available: 1873.2, activeDeploymentCount: 7 });

    expect(screen.getByLabelText("Reserved balance")).toHaveTextContent("1338");
    expect(screen.getByLabelText("Available balance")).toHaveTextContent("1873.2");
    expect(screen.getByText("Held to keep your 7 deployments running")).toBeInTheDocument();
    expect(screen.getByText("Free to spend on something new")).toBeInTheDocument();
  });

  it("uses singular wording when a single deployment is running", () => {
    setup({ reserved: 100, activeDeploymentCount: 1 });

    expect(screen.getByText("Held to keep your 1 deployment running")).toBeInTheDocument();
  });

  it("reveals the deployment breakdown only after the collapsible is opened", () => {
    setup({ deployments: [{ dseq: "1", name: "llama-chat", reservedUsd: 508.8, perHourUsd: 4.24 }], available: 1873.2 });

    expect(screen.queryByText("llama-chat")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /What is reserved/ }));

    expect(screen.getByText("llama-chat")).toBeInTheDocument();
    expect(screen.getByText(/\/hr/)).toBeInTheDocument();
  });

  it("toggles the breakdown label between closed and open", () => {
    setup({ deployments: [{ dseq: "1", name: "llama-chat", reservedUsd: 508.8, perHourUsd: 4.24 }] });

    expect(screen.getByRole("button", { name: /What is reserved \(1\)/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /What is reserved/ }));

    expect(screen.getByRole("button", { name: /Hide breakdown/ })).toBeInTheDocument();
  });

  it("counts only deployments that still hold reserved funds so the label matches the badges", () => {
    setup({
      deployments: [
        { dseq: "1", name: "llama-chat", reservedUsd: 508.8, perHourUsd: 4.24 },
        { dseq: "2", name: "drained-app", reservedUsd: 0, perHourUsd: 0 }
      ]
    });

    expect(screen.getByRole("button", { name: /What is reserved \(1\)/ })).toBeInTheDocument();
  });

  it("hides the breakdown toggle when no deployment holds reserved funds", () => {
    setup({ deployments: [{ dseq: "1", name: "drained-app", reservedUsd: 0, perHourUsd: 0 }] });

    expect(screen.queryByRole("button", { name: /What is reserved/ })).not.toBeInTheDocument();
  });

  it("clears hover dimming when the hovered deployment disappears mid-hover", () => {
    const deployments = [
      { dseq: "1", name: "llama-chat", reservedUsd: 100, perHourUsd: 1 },
      { dseq: "2", name: "side-api", reservedUsd: 50, perHourUsd: 1 }
    ];
    const { rerenderWith } = setup({ deployments, available: 100 });

    fireEvent.click(screen.getByRole("button", { name: /What is reserved/ }));
    fireEvent.mouseEnter(screen.getByRole("link", { name: /llama-chat/ }).closest("li")!);

    expect(screen.getByRole("link", { name: /side-api/ }).closest("li")).toHaveStyle({ opacity: "0.4" });

    rerenderWith({ deployments: deployments.slice(1), available: 100 });

    expect(screen.getByRole("link", { name: /side-api/ }).closest("li")).toHaveStyle({ opacity: "1" });
  });

  it("links each deployment badge to its detail page", () => {
    setup({ deployments: [{ dseq: "42", name: "llama-chat", reservedUsd: 508.8, perHourUsd: 4.24 }] });

    fireEvent.click(screen.getByRole("button", { name: /What is reserved/ }));

    expect(screen.getByRole("link", { name: /llama-chat/ })).toHaveAttribute("href", UrlService.deploymentDetails("42"));
  });

  it("reassures when auto recharge is on", () => {
    setup({ autoReloadEnabled: true });

    expect(screen.getByText(/Auto Recharge is on/)).toBeInTheDocument();
  });

  it("stays quiet about auto recharge when it is off", () => {
    setup({ autoReloadEnabled: false });

    expect(screen.queryByText(/Auto Recharge is on/)).not.toBeInTheDocument();
  });

  it("hides the auto recharge line when the bar already surfaces the top-up threshold", () => {
    setup({ autoReloadEnabled: true, autoReloadThreshold: 275 });

    expect(screen.queryByText(/Auto Recharge is on/)).not.toBeInTheDocument();
  });

  it("renders a skeleton instead of balance while loading", () => {
    setup({ isLoading: true });

    expect(screen.queryByLabelText("Total account balance")).not.toBeInTheDocument();
  });

  function setup(overview: Partial<AccountBalanceOverviewData>) {
    const MockFormattedNumber = vi.fn(({ value }: { value: number }) => <>{value}</>);

    const renderView = (partial: Partial<AccountBalanceOverviewData>) => {
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
        autoReloadThreshold: null,
        isLoading: false,
        ...partial
      };

      return (
        <AccountBalanceOverview
          dependencies={
            {
              ...MockComponents(DEPENDENCIES),
              useAccountBalanceOverview: () => data,
              FormattedNumber: MockFormattedNumber,
              Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>
            } as unknown as typeof DEPENDENCIES
          }
        />
      );
    };

    const view = render(renderView(overview));

    return { ...view, rerenderWith: (next: Partial<AccountBalanceOverviewData>) => view.rerender(renderView(next)) };
  }
});
