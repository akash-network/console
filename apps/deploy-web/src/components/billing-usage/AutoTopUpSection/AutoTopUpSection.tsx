"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { Button, Card, CardContent, CardHeader, Skeleton, Snackbar, Switch } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { LinearProgress } from "@mui/material";
import { Edit } from "iconoir-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";

import { useAccountBalanceOverview } from "@src/components/billing-usage/AccountBalanceOverview/useAccountBalanceOverview";
import {
  AutoTopUpSettingsPopup,
  DEFAULT_AUTO_RELOAD_AMOUNT,
  DEFAULT_AUTO_RELOAD_THRESHOLD
} from "@src/components/billing-usage/AutoTopUpSettingsPopup/AutoTopUpSettingsPopup";
import { useBillingActions } from "@src/components/billing-usage/BillingActionsProvider/BillingActionsProvider";
import { UsdValue } from "@src/components/billing-usage/UsdValue/UsdValue";
import { useAutoReloadMode } from "@src/components/billing-usage/useAutoReloadMode";
import { useServices } from "@src/context/ServicesProvider";
import { useDefaultPaymentMethodQuery, useWalletSettingsMutations, useWalletSettingsQuery, useWeeklyDeploymentCostQuery } from "@src/queries";
import { capitalizeFirstLetter } from "@src/utils/stringUtils";

const HOURS_PER_DAY = 24;

/** Set by the deploy flow's "Add Payment Method" CTA, which needs a card and auto top-up in one trip. */
const SETUP_PARAM = "setupAutoTopUp";

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
  AutoTopUpSettingsPopup,
  UsdValue,
  Button,
  Card,
  CardContent,
  CardHeader,
  Skeleton,
  Snackbar,
  Switch,
  Edit,
  LinearProgress
};

export const AutoTopUpSection: React.FunctionComponent<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const [autoTopUpPopup, setAutoTopUpPopup] = useState<{ open: boolean; enableOnSave: boolean }>({ open: false, enableOnSave: false });
  const { mode, isThresholdModeOffered, showsThresholdRule } = d.useAutoReloadMode();
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

  const toggleAutoReload = useCallback(
    async (autoReloadEnabled: boolean) => {
      const promptMessage = autoReloadEnabled
        ? {
            title: "Enable automatic credit reloading?",
            message: "Your default payment method will be charged automatically when credits run low, so your deployments keep running."
          }
        : {
            title: "Disable automatic credit reloading?",
            message: "Your deployments may stop if your credit balance runs out, and no automatic charges will be made."
          };
      const isConfirmed = await confirm(promptMessage);

      if (!isConfirmed) {
        return;
      }

      const settings = {
        data: {
          autoReloadEnabled
        }
      };

      upsertWalletSettings.mutate(settings, {
        onSuccess: response =>
          enqueueSnackbar(<d.Snackbar title={`Auto Reload ${response.data.autoReloadEnabled ? "enabled" : "disabled"}`} iconVariant="success" />, {
            variant: "success",
            autoHideDuration: 3000
          }),
        onError: () => enqueueSnackbar(<d.Snackbar title="Failed to update Auto Reload settings" iconVariant="error" />, { variant: "error" })
      });
    },
    [confirm, enqueueSnackbar, upsertWalletSettings]
  );

  const disableAutoTopUp = useCallback(async () => {
    const isConfirmed = await confirm({
      title: "Disable Auto Top-Up?",
      message: "Your deployments may stop if your credit balance runs out, and no automatic charges will be made."
    });

    if (!isConfirmed) {
      return;
    }

    upsertWalletSettings.mutate(
      { data: { autoReloadEnabled: false } },
      {
        onSuccess: () => enqueueSnackbar(<d.Snackbar title="Auto Top-Up disabled" iconVariant="success" />, { variant: "success", autoHideDuration: 3000 }),
        onError: () => enqueueSnackbar(<d.Snackbar title="Failed to update Auto Top-Up settings" iconVariant="error" />, { variant: "error" })
      }
    );
  }, [confirm, enqueueSnackbar, upsertWalletSettings, d]);

  const handleAutoTopUpSwitch = useCallback(
    (checked: boolean) => (checked ? setAutoTopUpPopup({ open: true, enableOnSave: true }) : disableAutoTopUp()),
    [disableAutoTopUp]
  );

  const hasPaymentMethod = !!defaultPaymentMethod;
  const autoReloadThreshold = walletSettings?.autoReloadThreshold ?? DEFAULT_AUTO_RELOAD_THRESHOLD;
  const autoReloadAmount = walletSettings?.autoReloadAmount ?? DEFAULT_AUTO_RELOAD_AMOUNT;
  const autoReloadEnabled = walletSettings?.autoReloadEnabled ?? false;
  const isPausedByDeclines = autoReloadEnabled && !!walletSettings?.autoReloadPausedAt;
  const isFirstLoad = (isWalletSettingsLoading && !walletSettings) || (isDefaultPaymentMethodLoading && !defaultPaymentMethod);

  const isReloadChangeDisabled = useMemo(() => {
    return isFirstLoad || !hasPaymentMethod || upsertWalletSettings.isPending;
  }, [isFirstLoad, hasPaymentMethod, upsertWalletSettings.isPending]);

  const defaultCardLabel = useMemo(() => {
    const card = (defaultPaymentMethod as PaymentMethod | null | undefined)?.card;
    if (!card) return null;
    return `${capitalizeFirstLetter(card.brand || "card")} **** ${card.last4 || ""}`.trim();
  }, [defaultPaymentMethod]);

  const nextTopUpDays = useMemo(() => {
    const dailySpend = overview.perHour * HOURS_PER_DAY;
    if (dailySpend <= 0 || overview.available <= autoReloadThreshold) return null;
    return Math.max(1, Math.round((overview.available - autoReloadThreshold) / dailySpend));
  }, [overview.perHour, overview.available, autoReloadThreshold]);

  const isSetupRequested = searchParams.get(SETUP_PARAM) === "true";

  useEffect(
    function startSetupRequestedByDeepLink() {
      if (!isSetupRequested || isFirstLoad || hasStartedRequestedSetup.current) return;
      hasStartedRequestedSetup.current = true;

      const openSettingsToEnable = () => setAutoTopUpPopup({ open: true, enableOnSave: true });

      if (hasPaymentMethod) {
        openSettingsToEnable();
      } else {
        openAddPaymentMethod({ onSuccess: openSettingsToEnable });
      }

      router.replace(urlService.billing(), { scroll: false });
    },
    [isSetupRequested, isFirstLoad, hasPaymentMethod, router, urlService, openAddPaymentMethod]
  );

  const usd = (value: number) => <d.UsdValue value={value} />;

  return (
    <>
      <d.Card className="relative overflow-hidden">
        {upsertWalletSettings.isPending && (
          <div className="absolute left-0 right-0 top-0 flex flex-1 items-center">
            <d.LinearProgress color="primary" className="mx-auto w-full" />
          </div>
        )}
        <d.CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold leading-none">{isThresholdModeOffered ? "Auto Top-Up" : "Auto Recharge"}</h3>
            {isFirstLoad ? (
              <d.Skeleton className="h-4 w-72" />
            ) : !isThresholdModeOffered || !autoReloadEnabled || isPausedByDeclines ? (
              <p className="text-sm text-muted-foreground">Automatically adds credits to keep your deployments running.</p>
            ) : showsThresholdRule ? (
              <p className="text-sm text-muted-foreground">
                Tops up when your <span className="font-medium text-success">available</span> balance runs low.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Tops up to cover the week ahead for your running deployments.</p>
            )}
          </div>
          <d.Switch
            checked={autoReloadEnabled}
            onCheckedChange={isThresholdModeOffered ? handleAutoTopUpSwitch : toggleAutoReload}
            disabled={isReloadChangeDisabled}
          />
        </d.CardHeader>
        <d.CardContent>
          {isFirstLoad ? (
            <div className="space-y-3">
              <d.Skeleton className="h-9 w-40" />
              <d.Skeleton className="h-4 w-72" />
            </div>
          ) : !hasPaymentMethod ? (
            <p className="text-sm text-muted-foreground">
              <button type="button" onClick={() => openAddPaymentMethod()} className="text-primary underline">
                Add a payment method
              </button>{" "}
              to enable auto {isThresholdModeOffered ? "top-up" : "recharge"}
            </p>
          ) : isPausedByDeclines ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-destructive">Paused.</span> {defaultCardLabel ?? "Your default payment method"} was declined several times, so
              we&apos;ve stopped charging it. Your deployments keep running until your credits run out.{" "}
              <button type="button" onClick={() => openAddPaymentMethod()} className="text-primary underline">
                Update your payment method
              </button>{" "}
              to start topping up again.
            </p>
          ) : !isThresholdModeOffered ? (
            <p className="text-sm text-muted-foreground">
              Recharge amount is approximately{" "}
              {weeklyCost === undefined ? (
                <d.Skeleton className="inline-block h-4 w-12 align-middle" />
              ) : (
                <span className="font-medium text-foreground">{usd(weeklyCost)}</span>
              )}{" "}
              per week
            </p>
          ) : autoReloadEnabled ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                {showsThresholdRule ? (
                  <div className="flex flex-wrap gap-x-12 gap-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Threshold</p>
                      <p className="text-2xl font-bold leading-none">{usd(autoReloadThreshold)}</p>
                      <p className="text-xs text-muted-foreground">when available drops below</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Top up</p>
                      <p className="text-2xl font-bold leading-none">{usd(autoReloadAmount)}</p>
                      <p className="text-xs text-muted-foreground">added each time</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Predicted spend</p>
                    {weeklyCost === undefined ? <d.Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold leading-none">{usd(weeklyCost)}</p>}
                    <p className="text-xs text-muted-foreground">per week, from your running deployments</p>
                  </div>
                )}
                <d.Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  aria-label="Edit auto top-up settings"
                  disabled={isReloadChangeDisabled}
                  onClick={() => setAutoTopUpPopup({ open: true, enableOnSave: false })}
                >
                  <d.Edit className="h-4 w-4" />
                  Edit
                </d.Button>
              </div>
              {showsThresholdRule ? (
                <p className="border-t pt-4 text-sm text-muted-foreground">
                  Charges {defaultCardLabel ?? "your default payment method"} when your available balance falls below the threshold.
                  {nextTopUpDays !== null && (
                    <>
                      {" "}
                      Next top-up in about <span className="font-medium text-foreground">{`${nextTopUpDays} day${nextTopUpDays === 1 ? "" : "s"}`}</span> based
                      on your current spend rate.
                    </>
                  )}
                </p>
              ) : (
                <p className="border-t pt-4 text-sm text-muted-foreground">
                  Charges {defaultCardLabel ?? "your default payment method"} for whatever your deployments need to keep running for another week.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Turn on Auto Top-Up to add funds automatically before your balance runs out. You pick the rule when you set it up.
            </p>
          )}
        </d.CardContent>
      </d.Card>

      {isThresholdModeOffered && (
        <d.AutoTopUpSettingsPopup
          open={autoTopUpPopup.open}
          onClose={() => setAutoTopUpPopup(prev => ({ ...prev, open: false }))}
          enableOnSave={autoTopUpPopup.enableOnSave}
          mode={mode}
          threshold={walletSettings?.autoReloadThreshold}
          amount={walletSettings?.autoReloadAmount}
        />
      )}
    </>
  );
};
