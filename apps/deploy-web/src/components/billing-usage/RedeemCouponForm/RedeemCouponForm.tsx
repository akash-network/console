"use client";

import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FormattedNumber } from "react-intl";
import { Alert, AlertDescription, AlertTitle, Form, FormField, FormInput, LoadingButton } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { usePaymentPolling } from "@src/context/PaymentPollingProvider";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMutations } from "@src/queries";
import { handleCouponError, handleStripeError } from "@src/utils/stripeErrorHandler";

const couponFormSchema = z.object({
  coupon: z.string().trim().min(1, "Coupon code is required")
});

type CouponFormValues = z.infer<typeof couponFormSchema>;

/** How long the success alert stays visible before the sheet auto-closes. */
const AUTO_CLOSE_DELAY_MS = 1500;

// A credit-adding success carries the dollar amount; a coupon that adds nothing uses amountAdded: null.
type CouponFeedback = { type: "success"; amountAdded: number | null } | { type: "error"; message: string; userAction?: string };

export const DEPENDENCIES = {
  useForm,
  zodResolver,
  useUser,
  usePaymentMutations,
  usePaymentPolling,
  handleCouponError,
  handleStripeError
};

interface RedeemCouponFormProps {
  isWalletReady?: boolean;
  onProcessingChange?: (isProcessing: boolean) => void;
  onRedeemed?: () => void;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Redeems a fixed-amount coupon into the managed wallet. Applying a coupon is
 * side-effecting (it creates a Stripe invoice and credits the wallet), so there
 * is no preview step: the user submits a code, we apply it, then poll to refresh
 * the balance. Feedback stays inline via an Alert; once a credit-adding redemption
 * settles (balance poll done and, for trial users, the trial flipped) the success
 * alert shows briefly and then `onRedeemed` fires to close the sheet. Failures and
 * no-credit coupons keep the sheet open for another attempt.
 */
export function RedeemCouponForm({ isWalletReady = true, onProcessingChange, onRedeemed, dependencies: d = DEPENDENCIES }: RedeemCouponFormProps) {
  const { user } = d.useUser();
  const { pollForPayment, isPolling } = d.usePaymentPolling();
  const {
    applyCoupon: { isPending: isApplyingCoupon, mutateAsync: applyCoupon }
  } = d.usePaymentMutations();

  const [feedback, setFeedback] = useState<CouponFeedback | null>(null);

  const wasProcessingRef = useRef(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = d.useForm<CouponFormValues>({
    defaultValues: { coupon: "" },
    resolver: d.zodResolver(couponFormSchema)
  });

  const isProcessing = isApplyingCoupon || isPolling;
  const coupon = form.watch("coupon");
  const canSubmit = coupon.trim().length > 0 && isWalletReady && !isProcessing;

  useEffect(
    function reportProcessing() {
      onProcessingChange?.(isProcessing);
    },
    [isProcessing, onProcessingChange]
  );

  useEffect(
    function autoCloseAfterSuccessfulRedeem() {
      const wasProcessing = wasProcessingRef.current;
      wasProcessingRef.current = isProcessing;

      // A credit-adding redemption keeps `isProcessing` true through the balance poll
      // (and, for trial users, until the trial flips). Once it settles, leave the success
      // alert up briefly, then close the sheet via onRedeemed.
      if (wasProcessing && !isProcessing && feedback?.type === "success" && feedback.amountAdded !== null) {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = setTimeout(() => onRedeemed?.(), AUTO_CLOSE_DELAY_MS);
      }
    },
    [isProcessing, feedback, onRedeemed]
  );

  useEffect(function clearCloseTimeoutOnUnmount() {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const showError = (info: { message: string; userAction?: string }) => setFeedback({ type: "error", message: info.message, userAction: info.userAction });

  const onRedeem = async ({ coupon }: CouponFormValues) => {
    if (!user?.id) {
      showError({ message: "Unable to apply coupon. Please refresh the page and try again." });
      return;
    }

    setFeedback(null);

    try {
      const response = await applyCoupon({ coupon: coupon.trim(), userId: user.id });

      if (response.error) {
        showError(d.handleCouponError(response));
        return;
      }

      if (response.amountAdded && response.amountAdded > 0) {
        pollForPayment({ variant: "coupon" });
        setFeedback({ type: "success", amountAdded: response.amountAdded });
      } else {
        setFeedback({ type: "success", amountAdded: null });
      }
      form.reset();
    } catch (err) {
      showError(d.handleStripeError(err));
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={form.handleSubmit(onRedeem)}>
        <FormField
          control={form.control}
          name="coupon"
          render={({ field }) => (
            <FormInput
              {...field}
              type="text"
              label="Coupon code"
              placeholder="AKASH-XXXX-XXXX"
              autoComplete="off"
              onChange={e => {
                field.onChange(e);
                setFeedback(null);
              }}
            />
          )}
        />

        {feedback?.type === "success" && (
          <Alert variant="success">
            <AlertTitle className="text-sm font-medium">Coupon applied</AlertTitle>
            <AlertDescription>
              {feedback.amountAdded !== null ? (
                <>
                  <FormattedNumber value={feedback.amountAdded} style="currency" currency="USD" /> added to your balance.
                </>
              ) : (
                "Coupon applied. No credits were added to your balance."
              )}
            </AlertDescription>
          </Alert>
        )}

        {feedback?.type === "error" && (
          <Alert variant="destructive">
            <AlertDescription>
              <span className="block font-medium">{feedback.message}</span>
              {feedback.userAction && <span className="mt-1 block text-sm">{feedback.userAction}</span>}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <LoadingButton type="submit" className="w-full" loading={isProcessing} disabled={!canSubmit}>
            Redeem coupon
          </LoadingButton>
          {!isWalletReady && <p className="text-center text-sm text-muted-foreground">Setting up your account…</p>}
        </div>
      </form>
    </Form>
  );
}
