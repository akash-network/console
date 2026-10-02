import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { UrlService } from "@src/utils/urlUtils";
import { AccountBalanceOverview, DEPENDENCIES } from "./AccountBalanceOverview";
import type { AccountBalanceOverview as AccountBalanceOverviewData } from "./useAccountBalanceOverview";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

describe(AccountBalanceOverview.name, () => {
  it("renders the card under the Account section", () => {
    setup({ totalUsd: 10 });

    expect(screen.getByRole("region", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account Balance" })).toBeInTheDocument();
  });

  it("renders the total account balance", () => {
    setup({ totalUsd: 3211.2 });

    expect(screen.getByLabelText("Total account balance")).toHaveTextContent("3211.2");
  });

  it("shows the runway badge and lasts-until date while spending", () => {
    setup({ runwayDays: 12, perHour: 11.15, lastsUntil: new Date(2026, 7, 23) });

    expect(screen.getByText("12 days of runway")).toBeInTheDocument();
    expect(screen.getByText(/lasts until/)).toHaveTextContent("Spending 11.15/hr · lasts until Aug 23, 2026");
  });

  it("hides the runway indicator when nothing is being spent", () => {
    setup({ runwayDays: null, lastsUntil: null });

    expect(screen.queryByText(/of runway/)).not.toBeInTheDocument();
    expect(screen.queryByText(/lasts until/)).not.toBeInTheDocument();
  });

  it("hides the runway indicator until the lasts-until date is known", () => {
    setup({ runwayDays: 12, lastsUntil: null });

    expect(screen.queryByText(/of runway/)).not.toBeInTheDocument();
  });

  it("shows the escrow and available balances with their descriptors", () => {
    setup({
      totalUsd: 3211.2,
      escrow: 1338,
      available: 1873.2,
      deployments: [
        { dseq: "1", name: "app-a", escrowUsd: 1000, perHourUsd: 1 },
        { dseq: "2", name: "app-b", escrowUsd: 338, perHourUsd: 1 }
      ]
    });

    expect(screen.getByLabelText("Escrow balance")).toHaveTextContent("1338");
    expect(screen.getByLabelText("Available balance")).toHaveTextContent("1873.2");
    expect(screen.getByText("Held to keep your 2 deployments running")).toBeInTheDocument();
    expect(screen.getByText("Free to spend on something new")).toBeInTheDocument();
  });

  it("uses singular wording when a single deployment holds escrow funds", () => {
    setup({ escrow: 100, deployments: [{ dseq: "1", name: "app-a", escrowUsd: 100, perHourUsd: 1 }] });

    expect(screen.getByText("Held to keep your 1 deployment running")).toBeInTheDocument();
  });

  it("says nothing is running when no deployment holds escrow funds", () => {
    setup({ totalUsd: 50, available: 50 });

    expect(screen.getByText("No deployments running")).toBeInTheDocument();
    expect(screen.getByText("Free to spend on something new")).toBeInTheDocument();
  });

  it("invites an account with an empty balance to add funds", () => {
    setup({ totalUsd: 0, available: 0 });

    expect(screen.getByText("Add to your balance to start deploying")).toBeInTheDocument();
    expect(screen.queryByText("Free to spend on something new")).not.toBeInTheDocument();
  });

  it("invites an account whose whole balance is in escrow to add funds for new deployments", () => {
    setup({ totalUsd: 100, escrow: 100, available: 0, deployments: [{ dseq: "1", name: "app-a", escrowUsd: 100, perHourUsd: 1 }] });

    expect(screen.getByText("Add to your balance to deploy something new")).toBeInTheDocument();
    expect(screen.queryByText("Free to spend on something new")).not.toBeInTheDocument();
  });

  it("passes the escrowed deployments and the available balance to the bar", () => {
    const { BalanceBreakdownBar } = setup({ available: 300, deployments: [{ dseq: "1", name: "llama-chat", escrowUsd: 100, perHourUsd: 1 }] });

    expect(BalanceBreakdownBar).toHaveBeenLastCalledWith(
      expect.objectContaining({
        segments: [expect.objectContaining({ key: "1", amountUsd: 100 }), expect.objectContaining({ key: "available", amountUsd: 300 })]
      }),
      expect.anything()
    );
  });

  it("keeps the threshold line on the bar but leaves its caption to the auto recharge copy", () => {
    const { BalanceBreakdownBar } = setup({ autoReloadThreshold: 275 });

    expect(BalanceBreakdownBar).toHaveBeenLastCalledWith(expect.objectContaining({ threshold: 275, hideThresholdCaption: true }), expect.anything());
  });

  it("reveals the deployment breakdown only after Show breakdown is clicked", () => {
    setup({ deployments: [{ dseq: "1", name: "llama-chat", escrowUsd: 508.8, perHourUsd: 4.24 }], available: 1873.2 });

    expect(screen.queryByText("llama-chat")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show breakdown" }));

    expect(screen.getByRole("link", { name: /llama-chat/ })).toHaveTextContent("llama-chat4.24/hr508.8");
    expect(screen.getByText("Each running deployment keeps around 48 hours of its cost in escrow.")).toBeInTheDocument();
  });

  it("toggles the breakdown between shown and hidden", () => {
    setup({ deployments: [{ dseq: "1", name: "llama-chat", escrowUsd: 508.8, perHourUsd: 4.24 }] });

    fireEvent.click(screen.getByRole("button", { name: "Show breakdown" }));

    expect(screen.getByRole("button", { name: "Hide breakdown" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Hide breakdown" }));

    expect(screen.getByRole("button", { name: "Show breakdown" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("llama-chat")).not.toBeInTheDocument();
  });

  it("lists only the deployments that still hold escrow funds", () => {
    setup({
      deployments: [
        { dseq: "1", name: "llama-chat", escrowUsd: 508.8, perHourUsd: 4.24 },
        { dseq: "2", name: "drained-app", escrowUsd: 0, perHourUsd: 0 }
      ]
    });

    fireEvent.click(screen.getByRole("button", { name: "Show breakdown" }));

    expect(screen.getByText("Held to keep your 1 deployment running")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByText("drained-app")).not.toBeInTheDocument();
  });

  it("hides the breakdown toggle when no deployment holds escrow funds", () => {
    setup({ deployments: [{ dseq: "1", name: "drained-app", escrowUsd: 0, perHourUsd: 0 }] });

    expect(screen.queryByRole("button", { name: "Show breakdown" })).not.toBeInTheDocument();
  });

  it("highlights a deployment on the bar while its breakdown entry is hovered", () => {
    const { BalanceBreakdownBar } = setup({
      deployments: [
        { dseq: "1", name: "llama-chat", escrowUsd: 100, perHourUsd: 1 },
        { dseq: "2", name: "side-api", escrowUsd: 50, perHourUsd: 1 }
      ],
      available: 100
    });

    fireEvent.click(screen.getByRole("button", { name: "Show breakdown" }));
    fireEvent.mouseEnter(screen.getByRole("link", { name: /llama-chat/ }));

    expect(BalanceBreakdownBar).toHaveBeenLastCalledWith(expect.objectContaining({ hoveredKey: "1" }), expect.anything());
    expect(screen.getByRole("link", { name: /llama-chat/ })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("link", { name: /side-api/ })).not.toHaveAttribute("data-active");

    fireEvent.mouseLeave(screen.getByRole("link", { name: /llama-chat/ }));

    expect(BalanceBreakdownBar).toHaveBeenLastCalledWith(expect.objectContaining({ hoveredKey: null }), expect.anything());
    expect(screen.getByRole("link", { name: /llama-chat/ })).not.toHaveAttribute("data-active");
  });

  it("highlights a deployment while its breakdown entry has keyboard focus", () => {
    const { BalanceBreakdownBar } = setup({ deployments: [{ dseq: "1", name: "llama-chat", escrowUsd: 100, perHourUsd: 1 }] });

    fireEvent.click(screen.getByRole("button", { name: "Show breakdown" }));
    fireEvent.focus(screen.getByRole("link", { name: /llama-chat/ }));

    expect(BalanceBreakdownBar).toHaveBeenLastCalledWith(expect.objectContaining({ hoveredKey: "1" }), expect.anything());

    fireEvent.blur(screen.getByRole("link", { name: /llama-chat/ }));

    expect(BalanceBreakdownBar).toHaveBeenLastCalledWith(expect.objectContaining({ hoveredKey: null }), expect.anything());
  });

  it("follows hovers that start on the bar itself", () => {
    const { BalanceBreakdownBar } = setup({ deployments: [{ dseq: "1", name: "llama-chat", escrowUsd: 100, perHourUsd: 1 }] });

    fireEvent.click(screen.getByRole("button", { name: "Show breakdown" }));
    const { onHover } = BalanceBreakdownBar.mock.lastCall![0];
    act(() => onHover!("1"));

    expect(screen.getByRole("link", { name: /llama-chat/ })).toHaveAttribute("data-active", "true");
  });

  it("clears the highlight when the hovered deployment disappears mid-hover", () => {
    const deployments = [
      { dseq: "1", name: "llama-chat", escrowUsd: 100, perHourUsd: 1 },
      { dseq: "2", name: "side-api", escrowUsd: 50, perHourUsd: 1 }
    ];
    const { BalanceBreakdownBar, rerenderWith } = setup({ deployments, available: 100 });

    fireEvent.click(screen.getByRole("button", { name: "Show breakdown" }));
    fireEvent.mouseEnter(screen.getByRole("link", { name: /llama-chat/ }));
    rerenderWith({ deployments: deployments.slice(1), available: 100 });

    expect(BalanceBreakdownBar).toHaveBeenLastCalledWith(expect.objectContaining({ hoveredKey: null }), expect.anything());
  });

  it("links each breakdown entry to its deployment's detail page", () => {
    setup({ deployments: [{ dseq: "42", name: "llama-chat", escrowUsd: 508.8, perHourUsd: 4.24 }] });

    fireEvent.click(screen.getByRole("button", { name: "Show breakdown" }));

    expect(screen.getByRole("link", { name: /llama-chat/ })).toHaveAttribute("href", UrlService.deploymentDetails("42"));
  });

  it("holds the footer action next to the breakdown toggle", () => {
    setup({ deployments: [{ dseq: "1", name: "llama-chat", escrowUsd: 100, perHourUsd: 1 }], footerAction: <span>auto recharge row</span> });

    expect(screen.getByRole("button", { name: "Show breakdown" })).toBeInTheDocument();
    expect(screen.getByText("auto recharge row")).toBeInTheDocument();
  });

  it("keeps the footer action when nothing is in escrow", () => {
    setup({ deployments: [], footerAction: <span>auto recharge row</span> });

    expect(screen.getByText("auto recharge row")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show breakdown" })).not.toBeInTheDocument();
  });

  it("keeps the footer action reachable when the balance can't be loaded", () => {
    setup({ isError: true, footerAction: <span>auto recharge row</span> });

    expect(screen.getByText("auto recharge row")).toBeInTheDocument();
  });

  it("keeps the footer action in place while the balance loads", () => {
    setup({ isLoading: true, footerAction: <span>auto recharge row</span> });

    expect(screen.getByText("auto recharge row")).toBeInTheDocument();
  });

  it("renders a skeleton instead of the balance while loading", () => {
    setup({ isLoading: true });

    expect(screen.getByRole("heading", { name: "Account Balance" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Total account balance")).not.toBeInTheDocument();
  });

  it("keeps the card title and explains when the balance can't be loaded", () => {
    setup({ isError: true });

    expect(screen.getByRole("heading", { name: "Account Balance" })).toBeInTheDocument();
    expect(screen.getByText(/couldn't be loaded/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Total account balance")).not.toBeInTheDocument();
  });

  function setup({ footerAction, ...overview }: Partial<AccountBalanceOverviewData> & { footerAction?: ReactNode }) {
    const BalanceBreakdownBar = vi.fn<typeof DEPENDENCIES.BalanceBreakdownBar>(ComponentMock);
    const UsdValue = vi.fn(({ value }: { value: number }) => <>{value}</>);

    const renderView = (partial: Partial<AccountBalanceOverviewData>) => {
      const data: AccountBalanceOverviewData = {
        totalUsd: 0,
        escrow: 0,
        available: 0,
        deployments: [],
        perHour: 0,
        lastsUntil: null,
        runwayDays: null,
        autoReloadEnabled: false,
        autoReloadThreshold: null,
        isLoading: false,
        isError: false,
        ...partial
      };

      return (
        <AccountBalanceOverview
          footerAction={footerAction}
          dependencies={MockComponents(DEPENDENCIES, {
            useAccountBalanceOverview: () => data,
            BalanceBreakdownBar,
            UsdValue,
            Link: DEPENDENCIES.Link
          })}
        />
      );
    };

    const view = render(renderView(overview));

    return { ...view, BalanceBreakdownBar, rerenderWith: (next: Partial<AccountBalanceOverviewData>) => view.rerender(renderView(next)) };
  }
});
