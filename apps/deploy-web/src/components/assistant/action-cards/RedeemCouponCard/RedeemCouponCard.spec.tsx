import type { CouponResponse } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./RedeemCouponCard";
import { RedeemCouponCard } from "./RedeemCouponCard";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(RedeemCouponCard.name, () => {
  it("prefills the code the user gave and says it charges nothing", () => {
    const { chromeProps, decision } = setup({ code: "WELCOME-10" });

    expect(screen.getByRole("textbox", { name: "Coupon code" })).toHaveValue("WELCOME-10");
    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Redeem a coupon",
        tier: "confirm",
        decision,
        costNote: "Adds the coupon's credits to your balance. Nothing is charged.",
        confirmLabel: "Redeem",
        isConfirmDisabled: false
      })
    );
  });

  it("asks for the code when the assistant has none", async () => {
    const { chromeProps } = setup({ code: null });
    expect(chromeProps().isConfirmDisabled).toBe(true);

    await userEvent.type(screen.getByRole("textbox", { name: "Coupon code" }), "  SPRING  ");

    expect(chromeProps().isConfirmDisabled).toBe(false);
  });

  it("can't redeem before the user is known", () => {
    const { chromeProps } = setup({ code: "WELCOME-10", userId: null });

    expect(chromeProps().isConfirmDisabled).toBe(true);
  });

  it("applies the trimmed code like the billing page, then refreshes the balance", async () => {
    const { chromeProps, applyCoupon, pollForPayment } = setup({ code: " WELCOME-10 ", response: { amountAdded: 10 } });

    await act(() => chromeProps().onConfirm!(""));

    expect(applyCoupon).toHaveBeenCalledWith({ coupon: "WELCOME-10", userId: "user-1" });
    expect(pollForPayment).toHaveBeenCalledWith({ variant: "coupon" });
    expect(chromeProps().successMessage).toBe("$10.00 added to your balance.");
  });

  it("says when a coupon added no credits", async () => {
    const { chromeProps, pollForPayment } = setup({ code: "PERK", response: { amountAdded: 0 } });

    await act(() => chromeProps().onConfirm!(""));

    expect(pollForPayment).not.toHaveBeenCalled();
    expect(chromeProps().successMessage).toBe("Coupon applied. No credits were added to your balance.");
  });

  it("shows the coupon's refusal with what to do about it", async () => {
    const { chromeProps, handleCouponError } = setup({ code: "OLD", response: { error: { message: "Expired", code: "coupon_expired" } } });
    handleCouponError.mockReturnValue({ message: "This coupon has expired.", userAction: "Try another code." });

    await expect(chromeProps().onConfirm!("")).rejects.toThrow("This coupon has expired. Try another code.");
  });

  it("shows a failed request the way the billing page does", async () => {
    const { chromeProps, applyCoupon, handleStripeError } = setup({ code: "WELCOME-10" });
    const error = new Error("network");
    applyCoupon.mockRejectedValue(error);
    handleStripeError.mockReturnValue({ message: "Something went wrong." });

    await expect(chromeProps().onConfirm!("")).rejects.toThrow("Something went wrong.");
    expect(handleStripeError).toHaveBeenCalledWith(error);
  });

  it("hides the code once redeemed", () => {
    setup({ code: "WELCOME-10", status: "succeeded" });

    expect(screen.queryByRole("textbox", { name: "Coupon code" })).not.toBeInTheDocument();
  });

  function setup(input: {
    code: string | null;
    userId?: string | null;
    response?: { amountAdded?: number; error?: { message: string; code?: string } };
    status?: ActionCardDecision["status"];
  }) {
    const applyCoupon = vi.fn(async (_input: { coupon: string; userId: string }): Promise<CouponResponse> => ({ ...input.response }));
    const pollForPayment = vi.fn();
    const handleCouponError = vi.fn<typeof DEPENDENCIES.handleCouponError>();
    const handleStripeError = vi.fn<typeof DEPENDENCIES.handleStripeError>();
    const ActionCardChrome = vi.fn((props: ActionCardChromeProps) => <>{props.children}</>);
    const decision = mock<ActionCardDecision>({ status: input.status ?? "pending" });
    const userId = input.userId === undefined ? "user-1" : input.userId;

    render(
      <RedeemCouponCard
        action={{ type: "redeem_coupon", tier: "confirm", code: input.code }}
        decision={decision}
        dependencies={{
          useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: userId ? { id: userId } : undefined }),
          usePaymentMutations: () =>
            mock<ReturnType<typeof DEPENDENCIES.usePaymentMutations>>({
              applyCoupon: { mutateAsync: applyCoupon as ReturnType<typeof DEPENDENCIES.usePaymentMutations>["applyCoupon"]["mutateAsync"] }
            }),
          usePaymentPolling: () => mock<ReturnType<typeof DEPENDENCIES.usePaymentPolling>>({ pollForPayment }),
          handleCouponError,
          handleStripeError,
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return { chromeProps: () => ActionCardChrome.mock.lastCall![0], applyCoupon, pollForPayment, handleCouponError, handleStripeError, decision };
  }
});
