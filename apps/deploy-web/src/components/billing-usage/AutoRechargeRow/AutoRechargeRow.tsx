"use client";
import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { CustomNoDivTooltip, Skeleton, Snackbar, Switch } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { InfoCircle } from "iconoir-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";

import { useAccountBalanceOverview } from "@src/components/billing-usage/AccountBalanceOverview/useAccountBalanceOverview";
import {
  AutoRechargeSettingsPopup,
  DEFAULT_AUTO_RELOAD_AMOUNT,
  DEFAULT_AUTO_RELOAD_THRESHOLD
} from "@src/components/billing-usage/AutoRechargeSettingsPopup/AutoRechargeSettingsPopup";
import { useBillingActions } from "@src/components/billing-usage/BillingActionsProvider/BillingActionsProvider";
import { UsdValue } from "@src/components/billing-usage/UsdValue/UsdValue";
import { useAutoReloadMode } from "@src/components/billing-usage/useAutoReloadMode";
import { useServices } from "@src/context/ServicesProvider";
import { useDefaultPaymentMethodQuery, useWalletSettingsMutations, useWalletSettingsQuery, useWeeklyDeploymentCostQuery } from "@src/queries";
import { capitalizeFirstLetter } from "@src/utils/stringUtils";

const HOURS_PER_DAY = 24;

/** Set by the deploy flow's "Add Payment Method" CTA, which needs a card and auto recharge in one trip. */
const SETUP_PARAM = "setupAutoTopUp";

const AUTO_RECHARGE_TOOLTIP = "Automatically charges your default card to keep your deployments funded as escrow is spent.";

export const DEPENDENCIES = {
  useSnackbar,
  useDefaultPaymentMethodQuery,
  useWalletSettingsQuery,
  useWeeklyDeploymentCostQuery,
  useWalletSettingsMutations,
  useAccountBalanceOverview,
  usePopup,
  useBillingActions,
  useAutoReloadMode,
  useSearchParams,
  useRouter,
  useServices,
  AutoRechargeSettingsPopup,
  UsdValue,
  CustomNoDivTooltip,
  Skeleton,
  Snackbar,
  Switch,
  InfoCircle
};

export const AutoRechargeRow: React.FunctionComponent<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const [settingsPopup, setSettingsPopup] = useState<{ open: boolean; enableOnSave: boolean }>({ open: false, enableOnSave: false });
  const { mode, showsThresholdRule } = d.useAutoReloadMode();
  const { enqueueSnackbar } = d.useSnackbar();
  const { data: defaultPaymentMethod, isLoading: isDefaultPaymentMethodLoading } = d.useDefaultPaymentMethodQuery();
  const { data: walletSettings, isLoading: isWalletSettingsLoading } = d.useWalletSettingsQuery();
  const { data: weeklyCost } = d.useWeeklyDeploymentCostQuery({ enabled: !showsThresholdRule });
  const { upsertWalletSettings } = d.useWalletSettingsMutations();
  const { openAddPaymentMethod } = d.useBillingActions();
  const overview = d.useAccountBalanceOverview();
  const { confirm } = d.usePopup();
  const searchParams = d.useSearchParams();
  const router = d.useRouter();
  const { urlService } = d.useServices();
  const hasStartedRequestedSetup = useRef(false);

  const turnOffAutoRecharge = useCallback(async () => {
    const isConfirmed = await confirm({
      title: "Turn off auto recharge?",
      message: "Your deployments may stop if your credit balance runs out, and no automatic charges will be made."
    });

    if (!isConfirmed) {
      return;
    }

    upsertWalletSettings.mutate(
      { data: { autoReloadEnabled: false } },
      {
        onSuccess: () => enqueueSnackbar(<d.Snackbar title="Auto recharge turned off" iconVariant="success" />, { variant: "success", autoHideDuration: 3000 }),
        onError: () => enqueueSnackbar(<d.Snackbar title="Failed to update auto recharge settings" iconVariant="error" />, { variant: "error" })
      }
    );
  }, [confirm, enqueueSnackbar, upsertWalletSettings, d]);

  const toggleAutoRecharge = useCallback(
    (checked: boolean) => (checked ? setSettingsPopup({ open: true, enableOnSave: true }) : turnOffAutoRecharge()),
    [turnOffAutoRecharge]
  );

  const hasPaymentMethod = !!defaultPaymentMethod;
  const autoReloadThreshold = walletSettings?.autoReloadThreshold ?? DEFAULT_AUTO_RELOAD_THRESHOLD;
  const autoReloadAmount = walletSettings?.autoReloadAmount ?? DEFAULT_AUTO_RELOAD_AMOUNT;
  const autoReloadEnabled = walletSettings?.autoReloadEnabled ?? false;
  const isPausedByDeclines = autoReloadEnabled && !!walletSettings?.autoReloadPausedAt;
  const isFirstLoad = (isWalletSettingsLoading && !walletSettings) || (isDefaultPaymentMethodLoading && !defaultPaymentMethod);
  const isChangeDisabled = isFirstLoad || !hasPaymentMethod || upsertWalletSettings.isPending;

  const defaultCardLabel = useMemo(() => {
    const card = (defaultPaymentMethod as PaymentMethod | null | undefined)?.card;
    if (!card) return null;
    return `${capitalizeFirstLetter(card.brand || "card")} **** ${card.last4 || ""}`.trim();
  }, [defaultPaymentMethod]);

  const daysUntilNextRecharge = useMemo(() => {
    const dailySpend = overview.perHour * HOURS_PER_DAY;
    if (dailySpend <= 0 || overview.available <= autoReloadThreshold) return null;
    return Math.max(1, Math.round((overview.available - autoReloadThreshold) / dailySpend));
  }, [overview.perHour, overview.available, autoReloadThreshold]);

  const isSetupRequested = searchParams.get(SETUP_PARAM) === "true";

  useEffect(
    function startSetupRequestedByDeepLink() {
      if (!isSetupRequested || isFirstLoad || hasStartedRequestedSetup.current) return;
      hasStartedRequestedSetup.current = true;

      const openSettingsToEnable = () => setSettingsPopup({ open: true, enableOnSave: true });

      if (hasPaymentMethod) {
        openSettingsToEnable();
      } else {
        openAddPaymentMethod({ onSuccess: openSettingsToEnable });
      }

      router.replace(urlService.billing(), { scroll: false });
    },
    [isSetupRequested, isFirstLoad, hasPaymentMethod, router, urlService, openAddPaymentMethod]
  );

  const strong = (value: number) => (
    <span className="font-semibold text-foreground">
      <d.UsdValue value={value} />
    </span>
  );

  const renderSummary = (): ReactNode => {
    if (isFirstLoad) return <d.Skeleton className="h-4 w-56" />;

    if (!hasPaymentMethod) {
      return (
        <>
          <button type="button" onClick={() => openAddPaymentMethod()} className="font-medium text-foreground underline underline-offset-[3px]">
            Add a card
          </button>{" "}
          to turn on auto recharge
        </>
      );
    }

    if (isPausedByDeclines) {
      return (
        <>
          <span className="font-medium text-destructive">Paused</span> · {defaultCardLabel ?? "Your default card"} was declined several times.{" "}
          <button type="button" onClick={() => openAddPaymentMethod()} className="font-medium text-foreground underline underline-offset-[3px]">
            Update card
          </button>
        </>
      );
    }

    if (!autoReloadEnabled) return "Off · top up manually";

    if (!showsThresholdRule) {
      return weeklyCost === undefined ? <d.Skeleton className="h-4 w-56" /> : <>Covers the next week (~{strong(weeklyCost)}) of your deployments</>;
    }

    return (
      <>
        Adds {strong(autoReloadAmount)} when available drops to <d.UsdValue value={autoReloadThreshold} />
        {daysUntilNextRecharge !== null && ` · next in ~${daysUntilNextRecharge} day${daysUntilNextRecharge === 1 ? "" : "s"}`}
      </>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
        <span className="text-[13px] text-muted-foreground" data-testid="auto-recharge-summary">
          {renderSummary()}
        </span>
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium">
            Auto Recharge
            <d.CustomNoDivTooltip title={AUTO_RECHARGE_TOOLTIP}>
              <span className="inline-flex cursor-help text-muted-foreground">
                <d.InfoCircle className="h-[13px] w-[13px]" />
              </span>
            </d.CustomNoDivTooltip>
          </span>
          <d.Switch checked={autoReloadEnabled} onCheckedChange={toggleAutoRecharge} disabled={isChangeDisabled} aria-label="Auto recharge" />
          {autoReloadEnabled && !isPausedByDeclines && hasPaymentMethod && (
            <button
              type="button"
              className="text-[13px] font-medium underline underline-offset-[3px] disabled:opacity-50"
              aria-label="Edit auto recharge settings"
              disabled={isChangeDisabled}
              onClick={() => setSettingsPopup({ open: true, enableOnSave: false })}
            >
              Edit
            </button>
          )}
        </span>
      </div>

      <d.AutoRechargeSettingsPopup
        open={settingsPopup.open}
        onClose={() => setSettingsPopup(prev => ({ ...prev, open: false }))}
        enableOnSave={settingsPopup.enableOnSave}
        mode={mode}
        threshold={walletSettings?.autoReloadThreshold}
        amount={walletSettings?.autoReloadAmount}
      />
    </>
  );
};
