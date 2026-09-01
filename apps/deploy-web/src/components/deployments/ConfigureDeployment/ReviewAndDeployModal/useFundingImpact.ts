"use client";
import { useAccountBalanceOverview } from "@src/components/billing-usage/AccountBalanceOverview/useAccountBalanceOverview";
import { AUTO_RELOAD_AMOUNT_MIN_USD, DEFAULT_AUTO_RELOAD_AMOUNT } from "@src/components/billing-usage/AutoTopUpSettingsPopup/AutoTopUpSettingsPopup";
import { useServices } from "@src/context/ServicesProvider";
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
  useServices,
  useDeploymentFundingConfigQuery
};

export type FundingImpactState = "funded" | "crosses-threshold" | "trial" | "no-payment-method" | "not-enough-available";

export type FundingImpact =
  | { kind: "hidden" }
  | { kind: "loading" }
  | { kind: "unavailable" }
  | {
      kind: "visible";
      state: FundingImpactState;
      escrowUsd: number;
      availableNowUsd: number;
      /** Null when the remaining escrow exceeds what is available, where an "available after" figure would be a lie. */
      availableAfterUsd: number | null;
      thresholdUsd: number | null;
      chargeUsd: number;
      cardLabel: string | null;
      trialDurationHours: number;
    };

type Input = {
  rows: ReviewRow[];
  runtimeLimitHours: number | undefined;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Estimates what confirming the reviewed deployment does to the account's money: automatic funding
 * escrows the target runway's worth of the reviewed bid prices (bounded by the runtime limit), floored
 * at the bootstrap deposit the deployment already holds from creation. Since that bootstrap already left
 * the available balance, only the difference up to the escrow is drawn at confirm time.
 */
export function useFundingImpact({ rows, runtimeLimitHours, dependencies: d = DEPENDENCIES }: Input): FundingImpact {
  const isEscrowAbstracted = d.useIsEscrowAbstracted();
  const overview = d.useAccountBalanceOverview();
  const { udenomToUsd } = d.usePricing();
  const { data: walletSettings } = d.useWalletSettingsQuery();
  const defaultPaymentMethod = d.useDefaultPaymentMethodQuery();
  const { isTrialing } = d.useWallet();
  const { publicConfig } = d.useServices();
  const fundingConfig = d.useDeploymentFundingConfigQuery();

  const pricedRows = rows.filter((row): row is ReviewRow & { price: { amount: string; denom: string } } => !!row.price);

  if (!isEscrowAbstracted || pricedRows.length === 0) return { kind: "hidden" };
  if (overview.isError || fundingConfig.isError || defaultPaymentMethod.isError) return { kind: "unavailable" };
  if (overview.isLoading || !fundingConfig.data || defaultPaymentMethod.isLoading) return { kind: "loading" };

  const { targetRunwayHours, defaultDepositUsd } = fundingConfig.data;
  const perBlockUdenom = pricedRows.reduce((sum, row) => sum + Number(row.price.amount), 0);
  const hourlyCostUsd = udenomToUsd(perBlockUdenom * API_BLOCKS_PER_HOUR, pricedRows[0].price.denom);
  const fundedHours = runtimeLimitHours === undefined ? targetRunwayHours : Math.min(targetRunwayHours, runtimeLimitHours);
  const escrowUsd = Math.max(defaultDepositUsd, hourlyCostUsd * fundedHours);
  /** The bootstrap deposit was drawn at creation and already sits in escrow, so confirming only draws the rest. */
  const remainingDrawUsd = escrowUsd - defaultDepositUsd;

  const availableNowUsd = overview.available;
  const availableAfterUsd = availableNowUsd >= remainingDrawUsd ? availableNowUsd - remainingDrawUsd : null;
  const thresholdUsd = overview.autoReloadThreshold;
  const hasPaymentMethod = !!defaultPaymentMethod.data;
  const card = defaultPaymentMethod.data?.card;

  return {
    kind: "visible",
    state: resolveState({ availableAfterUsd, thresholdUsd, hasPaymentMethod, isTrialing }),
    escrowUsd,
    availableNowUsd,
    availableAfterUsd,
    thresholdUsd,
    chargeUsd: Math.max(walletSettings?.autoReloadAmount ?? DEFAULT_AUTO_RELOAD_AMOUNT, AUTO_RELOAD_AMOUNT_MIN_USD),
    cardLabel: card ? `${capitalizeFirstLetter(card.brand || "card")} **** ${card.last4 || ""}`.trim() : null,
    trialDurationHours: publicConfig.NEXT_PUBLIC_TRIAL_DEPLOYMENTS_DURATION_HOURS
  };
}

/**
 * First match wins: a balance that cannot cover the escrow outranks everything, then a charge that is
 * really coming (auto top-up ignores the trial flag, so a trialing card gets charged like any other), then
 * the trial, so a trialing account is never told its card is missing, then the genuinely missing card.
 */
function resolveState(input: {
  availableAfterUsd: number | null;
  thresholdUsd: number | null;
  hasPaymentMethod: boolean;
  isTrialing: boolean;
}): FundingImpactState {
  if (input.availableAfterUsd === null) return "not-enough-available";
  if (input.hasPaymentMethod && input.thresholdUsd !== null && input.availableAfterUsd <= input.thresholdUsd) return "crosses-threshold";
  if (input.isTrialing) return "trial";
  if (!input.hasPaymentMethod) return "no-payment-method";
  return "funded";
}
