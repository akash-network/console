"use client";
import { useAccountBalanceOverview } from "@src/components/billing-usage/AccountBalanceOverview/useAccountBalanceOverview";
import { AUTO_RELOAD_AMOUNT_MIN_USD, DEFAULT_AUTO_RELOAD_AMOUNT } from "@src/components/billing-usage/AutoTopUpSettingsPopup/AutoTopUpSettingsPopup";
import { useWallet } from "@src/context/WalletProvider";
import { useIsEscrowAbstracted } from "@src/hooks/useIsEscrowAbstracted";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import { useDeploymentFundingConfigQuery, useWalletSettingsQuery } from "@src/queries";
import { useDefaultPaymentMethodQuery } from "@src/queries/usePaymentQueries";
import { API_BLOCKS_PER_HOUR } from "@src/utils/deploymentUtils";
import { capitalizeFirstLetter } from "@src/utils/stringUtils";
import type { ReviewRow } from "./useReviewRows";

export const DEPENDENCIES = {
  useIsEscrowAbstracted,
  useAccountBalanceOverview,
  usePricing,
  useWalletSettingsQuery,
  useDefaultPaymentMethodQuery,
  useWallet,
  useDeploymentFundingConfigQuery
};

export type FundingImpactState = "funded" | "crosses-threshold" | "no-payment-method" | "not-enough-available";

export type FundingImpact =
  | { kind: "hidden" }
  | { kind: "unavailable" }
  | {
      kind: "visible";
      state: FundingImpactState;
      reserveUsd: number;
      availableNowUsd: number;
      /** Null when the remaining reserve exceeds what is available, where an "available after" figure would be a lie. */
      availableAfterUsd: number | null;
      /** How much runtime the reserve pays for, bounded by the runtime limit; null when the bids are free. */
      runtimeCoveredHours: number | null;
      thresholdUsd: number | null;
      chargeUsd: number;
      cardLabel: string | null;
    };

type Input = {
  rows: ReviewRow[];
  runtimeLimitHours: number | undefined;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Estimates what confirming the reviewed deployment does to the account's money: automatic funding
 * reserves the target runway's worth of the reviewed bid prices (bounded by the runtime limit), floored
 * at the bootstrap deposit the deployment already holds from creation. Since that bootstrap already left
 * the available balance, only the difference up to the reserve is drawn at confirm time.
 */
export function useFundingImpact({ rows, runtimeLimitHours, dependencies: d = DEPENDENCIES }: Input): FundingImpact {
  const isEscrowAbstracted = d.useIsEscrowAbstracted();
  const overview = d.useAccountBalanceOverview();
  const { udenomToUsd } = d.usePricing();
  const { data: walletSettings } = d.useWalletSettingsQuery();
  const defaultPaymentMethod = d.useDefaultPaymentMethodQuery();
  const { isTrialing } = d.useWallet();
  const fundingConfig = d.useDeploymentFundingConfigQuery();

  const pricedRows = rows.filter((row): row is ReviewRow & { price: { amount: string; denom: string } } => !!row.price);

  if (!isEscrowAbstracted || pricedRows.length === 0) return { kind: "hidden" };
  if (overview.isError || fundingConfig.isError) return { kind: "unavailable" };
  if (overview.isLoading || !fundingConfig.data || defaultPaymentMethod.isLoading) return { kind: "hidden" };

  const { targetRunwayHours, defaultDepositUsd } = fundingConfig.data;
  const perBlockUdenom = pricedRows.reduce((sum, row) => sum + Number(row.price.amount), 0);
  const hourlyCostUsd = udenomToUsd(perBlockUdenom * API_BLOCKS_PER_HOUR, pricedRows[0].price.denom);
  const fundedHours = runtimeLimitHours === undefined ? targetRunwayHours : Math.min(targetRunwayHours, runtimeLimitHours);
  const reserveUsd = Math.max(defaultDepositUsd, hourlyCostUsd * fundedHours);
  /** The bootstrap deposit was drawn at creation and already counts as reserved, so confirming only draws the rest. */
  const remainingDrawUsd = reserveUsd - defaultDepositUsd;
  const runtimeCoveredHours = hourlyCostUsd > 0 ? Math.min(reserveUsd / hourlyCostUsd, runtimeLimitHours ?? Infinity) : null;

  const availableNowUsd = overview.available;
  const availableAfterUsd = availableNowUsd >= remainingDrawUsd ? availableNowUsd - remainingDrawUsd : null;
  const thresholdUsd = overview.autoReloadThreshold;
  const hasPaymentMethod = !isTrialing && !!defaultPaymentMethod.data;
  const card = defaultPaymentMethod.data?.card;

  return {
    kind: "visible",
    state: resolveState({ availableAfterUsd, thresholdUsd, hasPaymentMethod }),
    reserveUsd,
    availableNowUsd,
    availableAfterUsd,
    runtimeCoveredHours,
    thresholdUsd,
    chargeUsd: Math.max(walletSettings?.autoReloadAmount ?? DEFAULT_AUTO_RELOAD_AMOUNT, AUTO_RELOAD_AMOUNT_MIN_USD),
    cardLabel: card ? `${capitalizeFirstLetter(card.brand || "card")} **** ${card.last4 || ""}`.trim() : null
  };
}

/**
 * First match wins: a balance that cannot cover the reserve outranks everything (its copy claims no
 * automatic charge, so it also holds for trial users), then the missing payment method (no charge can
 * happen, so no crossing warning may claim one), then the threshold crossing, then plain funded.
 */
function resolveState(input: { availableAfterUsd: number | null; thresholdUsd: number | null; hasPaymentMethod: boolean }): FundingImpactState {
  if (input.availableAfterUsd === null) return "not-enough-available";
  if (!input.hasPaymentMethod) return "no-payment-method";
  if (input.thresholdUsd !== null && input.availableAfterUsd <= input.thresholdUsd) return "crosses-threshold";
  return "funded";
}
