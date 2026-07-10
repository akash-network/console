import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./AddCreditsTabs";
import { AddCreditsTabs } from "./AddCreditsTabs";

import { render, screen } from "@testing-library/react";

describe(AddCreditsTabs.name, () => {
  it("renders a trigger for each tab", () => {
    setup({});

    expect(screen.getByRole("tab", { name: /purchase credits/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /redeem coupon/i })).toBeInTheDocument();
  });

  it("shows the purchase tab by default", () => {
    const AddCreditsForm = vi.fn(() => <div>purchase-form</div>);
    const RedeemCouponForm = vi.fn(() => <div>coupon-form</div>);

    setup({ dependencies: { AddCreditsForm, RedeemCouponForm } });

    expect(AddCreditsForm).toHaveBeenCalled();
    expect(RedeemCouponForm).not.toHaveBeenCalled();
  });

  it("shows the coupon tab when initialTab is coupon", () => {
    const AddCreditsForm = vi.fn(() => <div>purchase-form</div>);
    const RedeemCouponForm = vi.fn(() => <div>coupon-form</div>);

    setup({ initialTab: "coupon", dependencies: { AddCreditsForm, RedeemCouponForm } });

    expect(RedeemCouponForm).toHaveBeenCalled();
    expect(AddCreditsForm).not.toHaveBeenCalled();
  });

  it("forwards onRedeemed to the coupon form", () => {
    const onRedeemed = vi.fn();
    const RedeemCouponForm = vi.fn((_props: Parameters<typeof DEPENDENCIES.RedeemCouponForm>[0]) => <div>coupon-form</div>);

    setup({ initialTab: "coupon", onRedeemed, dependencies: { RedeemCouponForm } });

    expect(RedeemCouponForm.mock.calls[0][0]).toEqual(expect.objectContaining({ onRedeemed }));
  });

  it("forwards aggregated processing state to the parent", () => {
    const onProcessingChange = vi.fn();

    setup({ onProcessingChange, dependencies: { AddCreditsForm: reportingForm(true) } });

    expect(onProcessingChange).toHaveBeenCalledWith(true);
  });

  it("disables the inactive tab trigger while the active tab reports processing", () => {
    setup({ dependencies: { AddCreditsForm: reportingForm(true) } });

    expect(screen.getByRole("tab", { name: /redeem coupon/i })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /purchase credits/i })).not.toBeDisabled();
  });

  function reportingForm(isProcessing: boolean) {
    return ({ onProcessingChange }: Parameters<typeof DEPENDENCIES.AddCreditsForm>[0]) => {
      useEffect(() => onProcessingChange?.(isProcessing), [onProcessingChange]);
      return <></>;
    };
  }

  function setup(input: {
    initialTab?: "purchase" | "coupon";
    onDone?: (amount: number, organization?: string) => void;
    onRedeemed?: () => void;
    isWalletReady?: boolean;
    onProcessingChange?: (isProcessing: boolean) => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    return render(
      <AddCreditsTabs
        initialTab={input.initialTab}
        onDone={input.onDone ?? vi.fn()}
        onRedeemed={input.onRedeemed}
        isWalletReady={input.isWalletReady ?? true}
        onProcessingChange={input.onProcessingChange}
        dependencies={{
          Tabs,
          TabsList,
          TabsTrigger,
          TabsContent,
          AddCreditsForm: () => <></>,
          RedeemCouponForm: () => <></>,
          ...input.dependencies
        }}
      />
    );
  }
});
