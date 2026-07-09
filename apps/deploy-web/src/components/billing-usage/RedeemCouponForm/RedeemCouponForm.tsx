"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Redeems a fixed-amount coupon into the managed wallet. Applying a coupon is
 * side-effecting (it creates a Stripe invoice and credits the wallet), so there
 * is no preview step: the user submits a code, we apply it, then poll to refresh
 * the balance. Feedback stays inline — success and failure both render an Alert
 * and the surrounding sheet stays open so the user closes it themselves.
 */
export function RedeemCouponForm({ isWalletReady = true, onProcessingChange, dependencies: d = DEPENDENCIES }: RedeemCouponFormProps) {
  const { user } = d.useUser();
  const { pollForPayment, isPolling } = d.usePaymentPolling();
  const {
    applyCoupon: { isPending: isApplyingCoupon, mutateAsync: applyCoupon }
  } = d.usePaymentMutations();

  const [successAmount, setSuccessAmount] = useState<number | null>(null);
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);

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

  const clearMessages = () => {
    setSuccessAmount(null);
    setAppliedMessage(null);
    setError(null);
    setErrorAction(null);
  };

  const finalizeError = (info: { message: string; userAction?: string }) => {
    setSuccessAmount(null);
    setAppliedMessage(null);
    setError(info.message);
    setErrorAction(info.userAction ?? null);
  };

  const onRedeem = async ({ coupon }: CouponFormValues) => {
    if (!user?.id) {
      finalizeError({ message: "Unable to apply coupon. Please refresh the page and try again." });
      return;
    }

    clearMessages();

    try {
      const response = await applyCoupon({ coupon: coupon.trim(), userId: user.id });

      if (response.error) {
        finalizeError(d.handleCouponError(response));
        return;
      }

      if (response.amountAdded && response.amountAdded > 0) {
        pollForPayment();
        setSuccessAmount(response.amountAdded);
        form.reset();
      } else {
        setAppliedMessage("Coupon applied. No credits were added to your balance.");
      }
    } catch (err) {
      finalizeError(d.handleStripeError(err));
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
                clearMessages();
              }}
            />
          )}
        />

        {successAmount !== null && (
          <Alert variant="success">
            <AlertTitle className="text-sm font-medium">Coupon applied</AlertTitle>
            <AlertDescription>{successAmount} credits added to your balance.</AlertDescription>
          </Alert>
        )}

        {appliedMessage && (
          <Alert variant="success">
            <AlertTitle className="text-sm font-medium">Coupon applied</AlertTitle>
            <AlertDescription>{appliedMessage}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              <span className="block font-medium">{error}</span>
              {errorAction && <span className="mt-1 block text-sm">{errorAction}</span>}
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
