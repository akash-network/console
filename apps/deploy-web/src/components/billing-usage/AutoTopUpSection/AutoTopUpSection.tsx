"use client";
import React, { useCallback, useMemo, useState } from "react";
import { FormattedNumber } from "react-intl";
import { Button, Card, CardContent, CardHeader, CustomTooltip, Snackbar, Switch } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { LinearProgress } from "@mui/material";
import { Edit, InfoCircle } from "iconoir-react";
import Link from "next/link";
import { useSnackbar } from "notistack";

import {
  AutoTopUpSettingsPopup,
  DEFAULT_AUTO_RELOAD_AMOUNT,
  DEFAULT_AUTO_RELOAD_THRESHOLD
} from "@src/components/billing-usage/AutoTopUpSettingsPopup/AutoTopUpSettingsPopup";
import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useDefaultPaymentMethodQuery, useWalletSettingsMutations, useWalletSettingsQuery, useWeeklyDeploymentCostQuery } from "@src/queries";

export const DEPENDENCIES = {
  useSnackbar,
  useDefaultPaymentMethodQuery,
  useWalletSettingsQuery,
  useWeeklyDeploymentCostQuery,
  useWalletSettingsMutations,
  usePopup,
  useServices,
  useFlag,
  AutoTopUpSettingsPopup,
  FormattedNumber,
  Link,
  Button,
  Card,
  CardContent,
  CardHeader,
  CustomTooltip,
  Snackbar,
  Switch,
  Edit,
  LinearProgress
};

export const AutoTopUpSection: React.FunctionComponent<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const [autoTopUpPopup, setAutoTopUpPopup] = useState<{ open: boolean; enableOnSave: boolean }>({ open: false, enableOnSave: false });
  const isFixedThresholdEnabled = d.useFlag("auto_reload_fixed_threshold");
  const { enqueueSnackbar } = d.useSnackbar();
  const { data: defaultPaymentMethod } = d.useDefaultPaymentMethodQuery();
  const { data: walletSettings } = d.useWalletSettingsQuery();
  const { data: weeklyCost } = d.useWeeklyDeploymentCostQuery({ enabled: !isFixedThresholdEnabled });
  const { upsertWalletSettings } = d.useWalletSettingsMutations();
  const { confirm } = d.usePopup();
  const { urlService } = d.useServices();

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

  const isReloadChangeDisabled = useMemo(() => {
    return !hasPaymentMethod || upsertWalletSettings.isPending;
  }, [hasPaymentMethod, upsertWalletSettings.isPending]);

  return (
    <>
      <d.Card className="relative overflow-hidden">
        {upsertWalletSettings.isPending && (
          <div className="absolute left-0 right-0 top-0 flex flex-1 items-center">
            <d.LinearProgress color="primary" className="mx-auto w-full" />
          </div>
        )}
        <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <h3 className="text-sm font-medium leading-none text-muted-foreground">{isFixedThresholdEnabled ? "Auto Top-Up" : "Auto Recharge"}</h3>
          <d.CustomTooltip
            title={
              isFixedThresholdEnabled
                ? "Automatically charge your default payment method a fixed amount whenever your balance drops to or below your chosen threshold."
                : "Automatically add credits to your account using your default payment method to keep deployments running."
            }
          >
            <InfoCircle className="h-4 w-4 cursor-pointer text-muted-foreground" />
          </d.CustomTooltip>
        </d.CardHeader>
        <d.CardContent>
          <div className="flex flex-col gap-2">
            <d.Switch
              checked={walletSettings?.autoReloadEnabled ?? false}
              onCheckedChange={isFixedThresholdEnabled ? handleAutoTopUpSwitch : toggleAutoReload}
              disabled={isReloadChangeDisabled}
            />
            {!hasPaymentMethod ? (
              <p className="text-sm text-muted-foreground">
                <d.Link href={urlService.billing()} className="text-primary underline">
                  Add a payment method
                </d.Link>{" "}
                to enable auto {isFixedThresholdEnabled ? "top-up" : "recharge"}
              </p>
            ) : isFixedThresholdEnabled ? (
              walletSettings?.autoReloadEnabled ? (
                <div className="flex items-center justify-start gap-2">
                  <p className="text-sm text-muted-foreground">
                    Top up{" "}
                    <span className="font-medium text-foreground">
                      <d.FormattedNumber value={autoReloadAmount} style="currency" currency="USD" />
                    </span>{" "}
                    when balance ≤{" "}
                    <span className="font-medium text-foreground">
                      <d.FormattedNumber value={autoReloadThreshold} style="currency" currency="USD" />
                    </span>
                  </p>
                  <d.Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label="Edit auto top-up settings"
                    disabled={isReloadChangeDisabled}
                    onClick={() => setAutoTopUpPopup({ open: true, enableOnSave: false })}
                  >
                    <d.Edit className="h-4 w-4" />
                  </d.Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Add funds automatically</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                Recharge amount is approximately{" "}
                <span className="font-medium text-foreground">
                  <d.FormattedNumber value={weeklyCost ?? 0} style="currency" currency="USD" />
                </span>{" "}
                per week
              </p>
            )}
          </div>
        </d.CardContent>
      </d.Card>

      {isFixedThresholdEnabled && (
        <d.AutoTopUpSettingsPopup
          open={autoTopUpPopup.open}
          onClose={() => setAutoTopUpPopup(prev => ({ ...prev, open: false }))}
          enableOnSave={autoTopUpPopup.enableOnSave}
          threshold={walletSettings?.autoReloadThreshold}
          amount={walletSettings?.autoReloadAmount}
        />
      )}
    </>
  );
};
