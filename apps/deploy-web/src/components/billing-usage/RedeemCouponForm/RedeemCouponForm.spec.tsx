import React from "react";
import { useForm } from "react-hook-form";
import { IntlProvider } from "react-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { handleCouponError } from "@src/utils/stripeErrorHandler";
import type { DEPENDENCIES } from "./RedeemCouponForm";
import { RedeemCouponForm } from "./RedeemCouponForm";

import { act, fireEvent, render, screen } from "@testing-library/react";

describe(RedeemCouponForm.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies the coupon, refreshes the balance, shows the dollar amount inline and resets the field", async () => {
    const applyCoupon = vi.fn().mockResolvedValue({ coupon: null, amountAdded: 100 });
    const pollForPayment = vi.fn();

    setup({ applyCoupon, pollForPayment });

    typeCoupon("AKASH-1234-5678");

    await submit();

    expect(applyCoupon).toHaveBeenCalledWith({ coupon: "AKASH-1234-5678", userId: "user_1" });
    expect(pollForPayment).toHaveBeenCalledWith({ variant: "coupon" });
    expect(screen.getByText(/added to your balance/i)).toHaveTextContent("$100.00");
    expect(couponInput().value).toBe("");
  });

  it("shows an inline applied message and skips polling when the coupon adds no credits", async () => {
    const applyCoupon = vi.fn().mockResolvedValue({ coupon: null, amountAdded: 0 });
    const pollForPayment = vi.fn();

    setup({ applyCoupon, pollForPayment });

    typeCoupon("AKASH-1234-5678");

    await submit();

    expect(applyCoupon).toHaveBeenCalledWith({ coupon: "AKASH-1234-5678", userId: "user_1" });
    expect(pollForPayment).not.toHaveBeenCalled();
    expect(screen.getByText(/no credits were added to your balance/i)).toBeInTheDocument();
  });

  it("shows an inline error mapped from the coupon error code", async () => {
    const applyCoupon = vi.fn().mockResolvedValue({ coupon: null, error: { code: "coupon_expired", message: "nope" } });

    setup({ applyCoupon });

    typeCoupon("EXPIRED-CODE");

    await submit();

    expect(screen.getByText(/this coupon has expired or is no longer valid/i)).toBeInTheDocument();
    expect(screen.queryByText(/added to your balance/i)).not.toBeInTheDocument();
  });

  it("keeps the redeem button disabled and does not submit while the code is empty", async () => {
    const applyCoupon = vi.fn();

    setup({ applyCoupon });

    expect(redeemButton()).toBeDisabled();

    await submit();

    expect(applyCoupon).not.toHaveBeenCalled();
  });

  it("disables the redeem button and shows a hint while the wallet is not ready", () => {
    setup({ isWalletReady: false });

    typeCoupon("AKASH-1234-5678");

    expect(redeemButton()).toBeDisabled();
    expect(screen.getByText(/setting up your account/i)).toBeInTheDocument();
  });

  it("reports processing to the parent while the coupon is being applied", () => {
    const onProcessingChange = vi.fn();

    setup({ isApplyingCoupon: true, onProcessingChange });

    expect(onProcessingChange).toHaveBeenCalledWith(true);
  });

  it("closes the sheet shortly after a credit-adding redemption settles", async () => {
    const onRedeemed = vi.fn();
    const applyCoupon = vi.fn().mockResolvedValue({ coupon: null, amountAdded: 100 });

    const { setPolling } = setup({ applyCoupon, onRedeemed });

    typeCoupon("AKASH-1234-5678");
    await submit();

    // The balance poll runs (processing) then settles; only then does the auto-close fire.
    act(() => setPolling(true));
    vi.useFakeTimers();
    act(() => setPolling(false));

    expect(onRedeemed).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onRedeemed).toHaveBeenCalledTimes(1);
  });

  it("does not close the sheet when the coupon adds no credits", async () => {
    const onRedeemed = vi.fn();
    const applyCoupon = vi.fn().mockResolvedValue({ coupon: null, amountAdded: 0 });

    const { setPolling } = setup({ applyCoupon, onRedeemed });

    typeCoupon("AKASH-1234-5678");
    await submit();

    vi.useFakeTimers();
    act(() => setPolling(true));
    act(() => setPolling(false));
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onRedeemed).not.toHaveBeenCalled();
  });

  function couponInput() {
    return screen.getByLabelText(/coupon code/i) as HTMLInputElement;
  }

  function redeemButton() {
    return screen.getByRole("button", { name: /redeem coupon/i });
  }

  function typeCoupon(value: string) {
    fireEvent.change(couponInput(), { target: { value } });
  }

  async function submit() {
    await act(async () => {
      fireEvent.submit(redeemButton().closest("form")!);
    });
  }

  function setup(input: {
    applyCoupon?: ReturnType<typeof DEPENDENCIES.usePaymentMutations>["applyCoupon"]["mutateAsync"];
    isApplyingCoupon?: boolean;
    pollForPayment?: ReturnType<typeof DEPENDENCIES.usePaymentPolling>["pollForPayment"];
    isPolling?: boolean;
    isWalletReady?: boolean;
    onProcessingChange?: (isProcessing: boolean) => void;
    onRedeemed?: () => void;
  }) {
    const pollingRef = { current: input.isPolling ?? false };

    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({
        user: { userId: "user_1", id: "user_1" } as ReturnType<typeof DEPENDENCIES.useUser>["user"]
      });

    const usePaymentMutations: typeof DEPENDENCIES.usePaymentMutations = () =>
      mock<ReturnType<typeof DEPENDENCIES.usePaymentMutations>>({
        applyCoupon: mock<ReturnType<typeof DEPENDENCIES.usePaymentMutations>["applyCoupon"]>({
          isPending: input.isApplyingCoupon ?? false,
          mutateAsync: input.applyCoupon ?? vi.fn().mockResolvedValue({ coupon: null, amountAdded: 0 })
        })
      });

    const usePaymentPolling: typeof DEPENDENCIES.usePaymentPolling = () =>
      mock<ReturnType<typeof DEPENDENCIES.usePaymentPolling>>({
        pollForPayment: input.pollForPayment ?? vi.fn(),
        stopPolling: vi.fn(),
        isPolling: pollingRef.current
      });

    const dependencies = {
      useForm,
      zodResolver,
      useUser,
      usePaymentMutations,
      usePaymentPolling,
      handleCouponError,
      handleStripeError: vi.fn().mockReturnValue({ message: "Something went wrong.", userAction: undefined })
    };

    // Build a fresh element each render so React does not bail out on an identical
    // element reference; the mocked polling hook reads `pollingRef` at call time.
    const build = () => (
      <IntlProvider locale="en-US" defaultLocale="en-US">
        <RedeemCouponForm
          isWalletReady={input.isWalletReady ?? true}
          onProcessingChange={input.onProcessingChange}
          onRedeemed={input.onRedeemed}
          dependencies={dependencies}
        />
      </IntlProvider>
    );

    const utils = render(build());

    const setPolling = (value: boolean) => {
      pollingRef.current = value;
      utils.rerender(build());
    };

    return { ...utils, setPolling };
  }
});
