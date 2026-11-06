"use client";
import type { FC } from "react";
import { useState } from "react";
import { Input } from "@akashnetwork/ui/components";

import { usePaymentPolling } from "@src/context/PaymentPollingProvider";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMutations } from "@src/queries";
import { handleCouponError, handleStripeError } from "@src/utils/stripeErrorHandler";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { formatUsd } from "../formatUsd";

export const DEPENDENCIES = {
  useUser,
  usePaymentMutations,
  usePaymentPolling,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  handleCouponError,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  handleStripeError,
  ActionCardChrome
};

function messageOf({ message, userAction }: { message: string; userAction?: string }): string {
  return userAction ? `${message} ${userAction}` : message;
}

export const RedeemCouponCard: FC<ActionCardProps<"redeem_coupon"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { user } = d.useUser();
  const { applyCoupon } = d.usePaymentMutations();
  const { pollForPayment } = d.usePaymentPolling();
  const [code, setCode] = useState(action.code ?? "");
  const [amountAdded, setAmountAdded] = useState<number | null>(null);
  const coupon = code.trim();
  const userId = user?.id;

  const redeem = async () => {
    const response = await applyCoupon.mutateAsync({ coupon, userId: userId as string }).catch(error => {
      throw new Error(messageOf(d.handleStripeError(error)), { cause: error });
    });
    if (response.error) throw new Error(messageOf(d.handleCouponError(response)));

    if (response.amountAdded && response.amountAdded > 0) {
      pollForPayment({ variant: "coupon" });
      setAmountAdded(response.amountAdded);
    }
  };

  return (
    <d.ActionCardChrome
      title="Redeem a coupon"
      tier={action.tier}
      decision={decision}
      costNote="Adds the coupon's credits to your balance. Nothing is charged."
      confirmLabel="Redeem"
      successMessage={amountAdded === null ? "Coupon applied. No credits were added to your balance." : `${formatUsd(amountAdded)} added to your balance.`}
      isConfirmDisabled={!coupon || !userId}
      onConfirm={redeem}
    >
      {decision.status !== "succeeded" && (
        <Input
          label="Coupon code"
          placeholder="AKASH-XXXX-XXXX"
          autoComplete="off"
          value={code}
          onChange={event => setCode(event.target.value)}
          disabled={decision.status === "running"}
        />
      )}
    </d.ActionCardChrome>
  );
};
