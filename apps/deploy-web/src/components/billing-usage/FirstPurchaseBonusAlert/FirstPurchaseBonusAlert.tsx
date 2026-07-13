"use client";

import React from "react";
import { FormattedNumber } from "react-intl";
import { Alert, AlertDescription, AlertTitle } from "@akashnetwork/ui/components";
import { GiftIcon } from "lucide-react";

import { useFlag } from "@src/hooks/useFlag";
import { usePaymentTransactionsQuery } from "@src/queries";

/** Keep in sync with FirstPurchaseBonusService (apps/api). Amounts in dollars. */
const MIN_QUALIFYING_AMOUNT = 100;
const BONUS_PERCENT = 10;
const MAX_BONUS = 100;

export const DEPENDENCIES = {
  useFlag,
  usePaymentTransactionsQuery
};

interface FirstPurchaseBonusAlertProps {
  amount: number;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Promotes the one-time first-purchase bonus and previews it against the entered
 * amount. Hidden for users who already completed a paid purchase (any succeeded
 * Stripe charge — refunded charges keep the "succeeded" status and correctly count
 * as consumed). Coupon claims create no charge, so coupon users still see the offer.
 */
export function FirstPurchaseBonusAlert({ amount, dependencies: d = DEPENDENCIES }: FirstPurchaseBonusAlertProps) {
  const isEnabled = d.useFlag("first_purchase_bonus");
  const { data, isSuccess } = d.usePaymentTransactionsQuery(undefined, { enabled: isEnabled });

  const hasPaidBefore = !!data?.transactions.some(transaction => transaction.status === "succeeded");

  // Gate on isSuccess (not isFetched): a failed transactions fetch also sets isFetched, leaving `data`
  // empty and hasPaidBefore false, which would wrongly show the offer to users with unknown history.
  if (!isEnabled || !isSuccess || hasPaidBefore) return null;

  const bonus = Math.min(Math.floor(amount * BONUS_PERCENT) / 100, MAX_BONUS);
  const qualifies = amount >= MIN_QUALIFYING_AMOUNT;
  const missingAmount = MIN_QUALIFYING_AMOUNT - amount;

  return (
    <Alert variant="default" className="bg-blue-50 p-3 dark:bg-blue-950">
      <GiftIcon className="h-4 w-4" />
      {qualifies ? (
        <>
          <AlertTitle className="text-sm font-medium">
            You&apos;ll receive <FormattedNumber value={amount + bonus} style="currency" currency="USD" /> in credits
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            <FormattedNumber value={bonus} style="currency" currency="USD" /> first-purchase bonus included.
          </AlertDescription>
        </>
      ) : (
        <>
          <AlertTitle className="text-sm font-medium">First-purchase bonus</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Get 10% bonus credits on your first purchase of $100 or more, up to $100.
            {amount > 0 && (
              <>
                {" "}
                Add <FormattedNumber value={missingAmount} style="currency" currency="USD" /> more to qualify.
              </>
            )}
          </AlertDescription>
        </>
      )}
    </Alert>
  );
}
