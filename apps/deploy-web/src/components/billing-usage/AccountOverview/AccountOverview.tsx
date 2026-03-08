import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FormattedNumber } from "react-intl";
import { Button, Card, CardContent, CardHeader, CustomTooltip, Skeleton, Snackbar, Switch } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { LinearProgress } from "@mui/material";
import { InfoCircle, Plus, Wallet } from "iconoir-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";

import { PaymentPopup } from "@src/components/billing-usage/PaymentPopup/PaymentPopup";
import { PaymentSuccessAnimation } from "@src/components/billing-usage/PaymentSuccessAnimation/PaymentSuccessAnimation";
import { Title } from "@src/components/shared/Title";
import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDefaultPaymentMethodQuery, useWalletSettingsMutations, useWalletSettingsQuery, useWeeklyDeploymentCostQuery } from "@src/queries";

export const DEPENDENCIES = {
  useSnackbar,
  useDefaultPaymentMethodQuery,
  useWalletBalance,
  useWalletSettingsQuery,
  useWeeklyDeploymentCostQuery,
  useWalletSettingsMutations,
  usePopup,
  useSearchParams,
  useRouter,
  useServices,
  PaymentPopup,
  PaymentSuccessAnimation,
  Title,
  FormattedNumber,
  Link,
  Button,
  Card,
  CardContent,
  CardHeader,
  CustomTooltip,
  Skeleton,
  Snackbar,
  Switch,
  LinearProgress
};

export const AccountOverview: React.FunctionComponent<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState<{ amount: string; show: boolean }>({ amount: "", show: false });
  const { enqueueSnackbar } = d.useSnackbar();
  const { data: defaultPaymentMethod, isLoading: isLoadingDefaultPaymentMethod } = d.useDefaultPaymentMethodQuery();
  const { balance: walletBalance, isLoading: isWalletBalanceLoading } = d.useWalletBalance();
  const { data: walletSettings } = d.useWalletSettingsQuery();
  const { data: weeklyCost } = d.useWeeklyDeploymentCostQuery();
  const { upsertWalletSettings } = d.useWalletSettingsMutations();
  const { confirm } = d.usePopup();

  const searchParams = d.useSearchParams();
  const router = d.useRouter();
  const { urlService } = d.useServices();
  const isLoading = isLoadingDefaultPaymentMethod;

  useEffect(() => {
    if (!isLoading && searchParams.get("openPayment") === "true" && defaultPaymentMethod) {
      setShowPaymentPopup(true);
      router.replace(urlService.billing(), { scroll: false });
    }
  }, [isLoading, searchParams, defaultPaymentMethod, router, urlService]);

  const defaultPaymentMethodId = useMemo(() => {
    return defaultPaymentMethod?.id;
  }, [defaultPaymentMethod]);

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
        autoReloadEnabled
      };

      upsertWalletSettings.mutate(settings, {
        onSuccess: response =>
          enqueueSnackbar(<d.Snackbar title={`Auto Reload ${response.autoReloadEnabled ? "enabled" : "disabled"}`} iconVariant="success" />, {
            variant: "success",
            autoHideDuration: 3000
          }),
        onError: () => enqueueSnackbar(<d.Snackbar title="Failed to update Auto Reload settings" iconVariant="error" />, { variant: "error" })
      });
    },
    [confirm, enqueueSnackbar, upsertWalletSettings]
  );

  const hasPaymentMethod = !!defaultPaymentMethod;

  const isReloadChangeDisabled = useMemo(() => {
    return !hasPaymentMethod || upsertWalletSettings.isPending;
  }, [hasPaymentMethod, upsertWalletSettings.isPending]);

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <d.Title subTitle>Your account</d.Title>
          <d.Skeleton className="h-9 w-28" />
        </div>

        <div className="pt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <d.Card>
              <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <d.Skeleton className="h-4 w-28" />
                <d.Skeleton className="h-4 w-4" />
              </d.CardHeader>
              <d.CardContent>
                <div className="flex flex-col gap-1">
                  <d.Skeleton className="h-8 w-24" />
                  <d.Skeleton className="h-4 w-40" />
                </div>
              </d.CardContent>
            </d.Card>
            <d.Card>
              <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <d.Skeleton className="h-4 w-28" />
                <d.Skeleton className="h-4 w-4" />
              </d.CardHeader>
              <d.CardContent>
                <div className="flex flex-col gap-2">
                  <d.Skeleton className="h-6 w-12 rounded-full" />
                  <d.Skeleton className="h-4 w-56" />
                </div>
              </d.CardContent>
            </d.Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <d.Title subTitle>Your account</d.Title>
        <d.CustomTooltip title="Add a payment method first to add funds" disabled={hasPaymentMethod}>
          <d.Button onClick={() => setShowPaymentPopup(true)} disabled={isWalletBalanceLoading || !hasPaymentMethod} size="sm">
            <Plus className="h-4 w-4" />
            Add Funds
          </d.Button>
        </d.CustomTooltip>
      </div>

      <div className="pt-6">
        <div className="grid gap-6 md:grid-cols-2">
          <d.Card className="relative overflow-hidden">
            {(!walletBalance || isWalletBalanceLoading) && (
              <div className="absolute left-0 right-0 top-0 flex flex-1 items-center">
                <d.LinearProgress color="primary" className="mx-auto w-full" />
              </div>
            )}
            <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <h3 className="text-sm font-medium leading-none text-muted-foreground">Available Balance</h3>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </d.CardHeader>
            <d.CardContent>
              <div className="flex flex-col gap-1">
                <p className="text-2xl font-bold leading-none">
                  {walletBalance && <d.FormattedNumber value={walletBalance.totalDeploymentGrantsUSD} style="currency" currency="USD" />}
                </p>
                <p className="text-sm text-muted-foreground">
                  {walletBalance && <d.FormattedNumber value={walletBalance.totalDeploymentEscrowUSD} style="currency" currency="USD" />} used in deployments
                </p>
              </div>
            </d.CardContent>
          </d.Card>
          <d.Card className="relative overflow-hidden">
            {upsertWalletSettings.isPending && (
              <div className="absolute left-0 right-0 top-0 flex flex-1 items-center">
                <d.LinearProgress color="primary" className="mx-auto w-full" />
              </div>
            )}
            <d.CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-1">
                <h3 className="text-sm font-medium leading-none text-muted-foreground">Auto Recharge</h3>
                <d.CustomTooltip title="Automatically add credits to your account using your default payment method to keep deployments running.">
                  <InfoCircle className="h-4 w-4 cursor-pointer text-muted-foreground" />
                </d.CustomTooltip>
              </div>
            </d.CardHeader>
            <d.CardContent>
              <div className="flex flex-col gap-2">
                <d.Switch checked={walletSettings?.autoReloadEnabled ?? false} onCheckedChange={toggleAutoReload} disabled={isReloadChangeDisabled} />
                {hasPaymentMethod ? (
                  <p className="text-sm text-muted-foreground">
                    Recharge amount is approximately{" "}
                    <span className="font-medium text-foreground">
                      <d.FormattedNumber value={weeklyCost ?? 0} style="currency" currency="USD" />
                    </span>{" "}
                    per week
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <d.Link href={urlService.paymentMethods()} className="text-primary underline">
                      Add a payment method
                    </d.Link>{" "}
                    to enable auto recharge
                  </p>
                )}
              </div>
            </d.CardContent>
          </d.Card>
        </div>

        <d.PaymentSuccessAnimation
          show={showPaymentSuccess.show}
          amount={showPaymentSuccess.amount}
          onComplete={() => setShowPaymentSuccess({ amount: "", show: false })}
        />
      </div>

      {showPaymentPopup && (
        <d.PaymentPopup
          open={showPaymentPopup}
          onClose={() => setShowPaymentPopup(false)}
          selectedPaymentMethodId={defaultPaymentMethodId}
          setShowPaymentSuccess={setShowPaymentSuccess}
        />
      )}
    </div>
  );
};
