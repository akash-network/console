"use client";

import React from "react";
import { FormattedNumber } from "react-intl";
import { Alert, Progress } from "@akashnetwork/ui/components";
import { GiftIcon } from "lucide-react";

import { useFlag } from "@src/hooks/useFlag";
import { usePaymentTransactionsQuery } from "@src/queries";

/** Keep in sync with FirstPurchaseBonusService (apps/api). Amounts in dollars. */
const MIN_QUALIFYING_AMOUNT = 100;
export const BONUS_PERCENT = 10;
export const MAX_BONUS = 100;
/** Purchase that first reaches the capped bonus (e.g. $1,000 at 10% for a $100 cap). */
const AMOUNT_FOR_MAX_BONUS = (MAX_BONUS * 100) / BONUS_PERCENT;

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

  const hasPaidBefore = !!data?.transactions?.some(transaction => transaction.status === "succeeded");

  // Gate on isSuccess (not isFetched): a failed transactions fetch also sets isFetched, leaving `data`
  // empty and hasPaidBefore false, which would wrongly show the offer to users with unknown history.
  if (!isEnabled || !isSuccess || hasPaidBefore) return null;

  const bonus = Math.min(Math.floor(amount * BONUS_PERCENT) / 100, MAX_BONUS);
  const qualifies = amount >= MIN_QUALIFYING_AMOUNT;
  const missingAmount = MIN_QUALIFYING_AMOUNT - amount;
  const amountToMaxBonus = AMOUNT_FOR_MAX_BONUS - amount;
  const progressToMaxBonus = Math.min((amount / AMOUNT_FOR_MAX_BONUS) * 100, 100);
  const progressToQualify = Math.min((amount / MIN_QUALIFYING_AMOUNT) * 100, 100);
  const bonusMaxed = bonus >= MAX_BONUS;

  return (
    <Alert variant="default" className="mb-6 bg-blue-50 p-4 dark:bg-blue-950">
      <GiftIcon className="h-4 w-4" />
      {qualifies ? (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">You&apos;ll receive</p>
            <p className="text-lg font-semibold">
              <FormattedNumber value={amount + bonus} style="currency" currency="USD" /> in credits
            </p>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Purchase</span>
              <span>
                <FormattedNumber value={amount} style="currency" currency="USD" />
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">First-purchase bonus ({BONUS_PERCENT}%)</span>
              <span className="font-medium text-primary">
                +<FormattedNumber value={bonus} style="currency" currency="USD" />
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Progress value={progressToMaxBonus} className="h-2 border border-blue-200 dark:border-blue-800" />
            <p className="text-xs text-muted-foreground">
              {bonusMaxed ? (
                <>
                  You&apos;ve unlocked the maximum <FormattedNumber value={MAX_BONUS} style="currency" currency="USD" /> bonus.
                </>
              ) : (
                <>
                  Add <FormattedNumber value={amountToMaxBonus} style="currency" currency="USD" /> more to unlock the full{" "}
                  <FormattedNumber value={MAX_BONUS} style="currency" currency="USD" /> bonus.
                </>
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">First-purchase bonus</p>
            <p className="text-xs text-muted-foreground">
              Get {BONUS_PERCENT}% in bonus credits on your first purchase, up to <FormattedNumber value={MAX_BONUS} style="currency" currency="USD" />.
            </p>
          </div>

          <div className="space-y-1.5">
            <Progress value={progressToQualify} className="h-2 border border-blue-200 dark:border-blue-800" />
            <p className="text-sm font-medium">
              {amount > 0 ? (
                <>
                  Add <FormattedNumber value={missingAmount} style="currency" currency="USD" /> more to unlock your bonus.
                </>
              ) : (
                <>
                  Add <FormattedNumber value={MIN_QUALIFYING_AMOUNT} style="currency" currency="USD" /> or more to unlock your bonus.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </Alert>
  );
}
