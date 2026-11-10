import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./AddCreditsTabs";
import { AddCreditsTabs } from "./AddCreditsTabs";

import { render, screen } from "@testing-library/react";
import { buildAccountStatus } from "@tests/seeders/accountStatus";

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

  it("forwards where the modal was opened from to the purchase form", () => {
    const AddCreditsForm = vi.fn((_props: Parameters<typeof DEPENDENCIES.AddCreditsForm>[0]) => <div>purchase-form</div>);

    setup({ context: "auto_deploy_needs_funds", dependencies: { AddCreditsForm } });

    expect(AddCreditsForm.mock.calls[0][0]).toEqual(expect.objectContaining({ context: "auto_deploy_needs_funds" }));
  });

  it("forwards the daily cost of the deployment the credits are for to the purchase form", () => {
    const AddCreditsForm = vi.fn((_props: Parameters<typeof DEPENDENCIES.AddCreditsForm>[0]) => <div>purchase-form</div>);

    setup({ deploymentDailyCostUsd: 12, dependencies: { AddCreditsForm } });

    expect(AddCreditsForm.mock.calls[0][0]).toEqual(expect.objectContaining({ deploymentDailyCostUsd: 12 }));
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

  it("explains instead of selling credits to a suspended account", () => {
    const AddCreditsForm = vi.fn(() => <div>purchase-form</div>);
    setup({ dependencies: { AddCreditsForm, useAccountStatus: () => buildAccountStatus("suspended") } });

    expect(screen.getByText(/Your account is suspended, so you can't buy credits or redeem coupons\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "mailto:support@akash.network");
    expect(screen.queryByRole("tab", { name: /redeem coupon/i })).not.toBeInTheDocument();
    expect(AddCreditsForm).not.toHaveBeenCalled();
  });

  it("explains instead of selling credits to a terminated account", () => {
    setup({ dependencies: { useAccountStatus: () => buildAccountStatus("terminated") } });

    expect(screen.getByText(/Your account has been terminated, so you can't buy credits or redeem coupons\./)).toBeInTheDocument();
  });

  function setup(input: {
    initialTab?: "purchase" | "coupon";
    context?: string;
    deploymentDailyCostUsd?: number;
    onDone?: (amount: number, bonusAmount?: number) => void;
    onRedeemed?: () => void;
    onProcessingChange?: (isProcessing: boolean) => void;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    return render(
      <AddCreditsTabs
        initialTab={input.initialTab}
        context={input.context}
        deploymentDailyCostUsd={input.deploymentDailyCostUsd}
        onDone={input.onDone ?? vi.fn()}
        onRedeemed={input.onRedeemed}
        onProcessingChange={input.onProcessingChange}
        dependencies={{
          Tabs,
          TabsList,
          TabsTrigger,
          TabsContent,
          AddCreditsForm: () => <></>,
          RedeemCouponForm: () => <></>,
          useAccountStatus: () => buildAccountStatus("active"),
          ...input.dependencies
        }}
      />
    );
  }
});
