import React, { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { AddCreditsSheet, DEPENDENCIES } from "./AddCreditsSheet";

import { act, render, screen } from "@testing-library/react";
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

  it("forwards onDone to the tabs", () => {
    const onDone = vi.fn();
    const { dependencies } = setup({ open: true, onDone });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalledWith(expect.objectContaining({ onDone }), expect.anything());
  });

  it("forwards onRedeemed to the tabs", () => {
    const onRedeemed = vi.fn();
    const { dependencies } = setup({ open: true, onRedeemed });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalledWith(expect.objectContaining({ onRedeemed }), expect.anything());
  });

  it("forwards isWalletReady to the tabs", () => {
    const { dependencies } = setup({ open: true, isWalletReady: false });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalledWith(expect.objectContaining({ isWalletReady: false }), expect.anything());
  });

  it("threads the initial tab to the tabs", () => {
    const { dependencies } = setup({ open: true, initialTab: "coupon" });

    expect(dependencies.AddCreditsTabs).toHaveBeenCalledWith(expect.objectContaining({ initialTab: "coupon" }), expect.anything());
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
    onDone?: (amount: number, organization?: string) => void;
    onRedeemed?: () => void;
    isWalletReady?: boolean;
    initialTab?: "purchase" | "coupon";
    description?: React.ReactNode;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const dependencies = MockComponents(DEPENDENCIES, input.dependencies);

    render(
      <AddCreditsSheet
        open={input.open}
        onOpenChange={input.onOpenChange ?? vi.fn()}
        onDone={input.onDone ?? vi.fn()}
        onRedeemed={input.onRedeemed}
        isWalletReady={input.isWalletReady}
        initialTab={input.initialTab}
        description={input.description}
        dependencies={dependencies}
      />
    );

    return { dependencies };
  }
});
