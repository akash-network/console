import React, { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { AddCreditsSheet, DEPENDENCIES } from "./AddCreditsSheet";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AddCreditsSheet.name, () => {
  it("renders the credits tabs when open", () => {
    const { dependencies } = setup({ open: true });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalled();
  });

  it("renders the default description when none is provided", () => {
    setup({ open: true });

    expect(screen.getByText(/this template needs a top-tier gpu/i)).toBeInTheDocument();
  });

  it("renders a custom description instead of the default copy when provided", () => {
    setup({ open: true, description: "Buy credits or redeem a coupon to top up your balance." });

    expect(screen.getByText(/buy credits or redeem a coupon to top up your balance/i)).toBeInTheDocument();
    expect(screen.queryByText(/this template needs a top-tier gpu/i)).not.toBeInTheDocument();
  });

  it("does not render the credits tabs while closed", () => {
    const { dependencies } = setup({ open: false });

    expect(dependencies.AddCreditsTabs).not.toHaveBeenCalled();
  });

  it("does not subscribe to the balance before a purchase succeeds", () => {
    const useWalletBalance = vi.fn<typeof DEPENDENCIES.useWalletBalance>();
    setup({ open: false, dependencies: { useWalletBalance } });

    expect(useWalletBalance).not.toHaveBeenCalled();
  });

  it("keeps a completed purchase visible until the user dismisses it", () => {
    const onDone = vi.fn();
    const { dependencies } = setup({ open: true, onDone });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onDone(100, 5));

    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/credits added/i);
    expect(screen.getByRole("status")).toHaveTextContent("$125.00");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith(100, 5);
  });

  it("forwards a redemption to onRedeemed", () => {
    const onRedeemed = vi.fn();
    const { dependencies } = setup({ open: true, onRedeemed });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onRedeemed!());

    expect(onRedeemed).toHaveBeenCalled();
  });

  it("tracks opening the sheet with the provided context", () => {
    const { analyticsService } = setup({ open: true, context: "skip-trial" });

    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_opened", { category: "billing", context: "skip-trial" });
  });

  it("leaves tracking the purchase to the purchase form when the tabs report completion", () => {
    const { analyticsService, dependencies } = setup({ open: true });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onDone(250, 10));

    expect(analyticsService.track).not.toHaveBeenCalledWith("add_credits_purchased", expect.anything());
  });

  it("tracks a cancellation when the sheet is closed without a purchase", () => {
    const onOpenChange = vi.fn();
    const { analyticsService, dependencies } = setup({ open: true, onOpenChange, dependencies: { AddCreditsTabs: reportingTabs(false) } });

    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_cancelled", { category: "billing", context: undefined });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not track a cancellation after a purchase completes", () => {
    const { analyticsService, dependencies } = setup({ open: true });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onDone(100));
    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(analyticsService.track).not.toHaveBeenCalledWith("add_credits_cancelled", expect.anything());
  });

  it("forwards the purchase only once when the success screen is dismissed repeatedly", () => {
    const onDone = vi.fn();
    const { dependencies } = setup({ open: true, onDone });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];

    act(() => tabsProps.onDone(100, 10));
    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));
    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(onDone).toHaveBeenCalledExactlyOnceWith(100, 10);
  });

  it("starts a fresh form when reopened after a successful purchase", () => {
    const { dependencies, rerender } = setup({ open: true });
    const tabsProps = dependencies.AddCreditsTabs.mock.calls.at(-1)![0] as Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0];
    act(() => tabsProps.onDone(100));

    rerender(false);
    rerender(true);

    expect(screen.queryByText("Payment successful")).not.toBeInTheDocument();
    expect(screen.getByText(/^Add credits/)).toBeInTheDocument();
  });

  it("threads the initial tab to the tabs", () => {
    const { dependencies } = setup({ open: true, initialTab: "coupon" });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalledWith(expect.objectContaining({ initialTab: "coupon" }), expect.anything());
  });

  it("threads where the sheet was opened from to the tabs", () => {
    const { dependencies } = setup({ open: true, context: "skip-trial" });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalledWith(expect.objectContaining({ context: "skip-trial" }), expect.anything());
  });

  it("blocks closing while the tabs report a payment in progress", () => {
    const onOpenChange = vi.fn();
    const { dependencies } = setup({ open: true, onOpenChange, dependencies: { AddCreditsTabs: reportingTabs(true) } });

    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("allows closing when no payment is in progress", () => {
    const onOpenChange = vi.fn();
    const { dependencies } = setup({ open: true, onOpenChange, dependencies: { AddCreditsTabs: reportingTabs(false) } });

    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hides the close button while the tabs report a payment in progress", () => {
    const { dependencies } = setup({ open: true, dependencies: { AddCreditsTabs: reportingTabs(true) } });

    expect(dependencies.SheetContent.mock.calls.at(-1)![0].hideCloseButton).toBe(true);
  });

  function reportingTabs(isProcessing: boolean) {
    return ({ onProcessingChange }: Parameters<typeof DEPENDENCIES.AddCreditsTabs>[0]) => {
      useEffect(() => onProcessingChange?.(isProcessing), [onProcessingChange]);
      return <></>;
    };
  }

  function setup(input: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    onDone?: (amount: number, bonusAmount?: number) => void;
    onRedeemed?: () => void;
    initialTab?: "purchase" | "coupon";
    description?: React.ReactNode;
    context?: string;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const analyticsService = mock<AnalyticsService>();
    const useServices = (() => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService })) as typeof DEPENDENCIES.useServices;
    const useWalletBalance: typeof DEPENDENCIES.useWalletBalance = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>({
        isLoading: false,
        balance: mock<NonNullable<ReturnType<typeof DEPENDENCIES.useWalletBalance>["balance"]>>({ totalUsd: 125 })
      });
    const dependencies = MockComponents(DEPENDENCIES, { useServices, useWalletBalance, ...input.dependencies });

    const renderSheet = (open: boolean) => (
      <AddCreditsSheet
        open={open}
        onOpenChange={input.onOpenChange ?? vi.fn()}
        onDone={input.onDone ?? vi.fn()}
        onRedeemed={input.onRedeemed}
        initialTab={input.initialTab}
        description={input.description}
        context={input.context}
        dependencies={dependencies}
      />
    );
    const view = render(renderSheet(input.open));

    return { dependencies, analyticsService, rerender: (open: boolean) => view.rerender(renderSheet(open)) };
  }
});
