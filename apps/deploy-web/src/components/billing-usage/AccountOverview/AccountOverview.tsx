import React, { useCallback, useMemo, useState } from "react";
import { FormattedNumber } from "react-intl";
import { Button, Card, CardContent, CardHeader, CustomTooltip, Skeleton, Snackbar, Switch } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { LinearProgress } from "@mui/material";
import { InfoCircle, Plus, Wallet } from "iconoir-react";
import Link from "next/link";
import { useSnackbar } from "notistack";

import { PaymentPopup } from "@src/components/billing-usage/PaymentPopup/PaymentPopup";
import { Title } from "@src/components/shared/Title";
import { PaymentSuccessAnimation } from "@src/components/user/payment/PaymentSuccessAnimation";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDefaultPaymentMethodQuery, useWalletSettingsMutations, useWalletSettingsQuery, useWeeklyDeploymentCostQuery } from "@src/queries";
import { UrlService } from "@src/utils/urlUtils";

export const AccountOverview: React.FunctionComponent = () => {
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState<{ amount: string; show: boolean }>({ amount: "", show: false });
  const { enqueueSnackbar } = useSnackbar();
  const { data: defaultPaymentMethod, isLoading: isLoadingDefaultPaymentMethod } = useDefaultPaymentMethodQuery();
  const { balance: walletBalance, isLoading: isWalletBalanceLoading } = useWalletBalance();
  const { data: walletSettings } = useWalletSettingsQuery();
  const { data: weeklyCost } = useWeeklyDeploymentCostQuery();
  const { upsertWalletSettings } = useWalletSettingsMutations();
  const { confirm } = usePopup();

  const isLoading = isLoadingDefaultPaymentMethod;

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
          enqueueSnackbar(<Snackbar title={`Auto Reload ${response.autoReloadEnabled ? "enabled" : "disabled"}`} iconVariant="success" />, {
            variant: "success",
            autoHideDuration: 3000
          }),
        onError: () => enqueueSnackbar(<Snackbar title="Failed to update Auto Reload settings" iconVariant="error" />, { variant: "error" })
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
          <Title subTitle>Your account</Title>
          <Skeleton className="h-9 w-28" />
        </div>

        <div className="pt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-6 w-12 rounded-full" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <Title subTitle>Your account</Title>
        <CustomTooltip title="Add a payment method first to add funds" disabled={hasPaymentMethod}>
          <Button onClick={() => setShowPaymentPopup(true)} disabled={isWalletBalanceLoading || !hasPaymentMethod} size="sm">
            <Plus className="h-4 w-4" />
            Add Funds
          </Button>
        </CustomTooltip>
      </div>

      <div className="pt-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="relative overflow-hidden">
            {(!walletBalance || isWalletBalanceLoading) && (
              <div className="absolute left-0 right-0 top-0 flex flex-1 items-center">
                <LinearProgress color="primary" className="mx-auto w-full" />
              </div>
            )}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <h3 className="text-sm font-medium leading-none text-muted-foreground">Available Balance</h3>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                <p className="text-2xl font-bold leading-none">
                  {walletBalance && <FormattedNumber value={walletBalance.totalDeploymentGrantsUSD} style="currency" currency="USD" />}
                </p>
                <p className="text-sm text-muted-foreground">
                  {walletBalance && <FormattedNumber value={walletBalance.totalDeploymentEscrowUSD} style="currency" currency="USD" />} used in deployments
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            {upsertWalletSettings.isPending && (
              <div className="absolute left-0 right-0 top-0 flex flex-1 items-center">
                <LinearProgress color="primary" className="mx-auto w-full" />
              </div>
            )}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-1">
                <h3 className="text-sm font-medium leading-none text-muted-foreground">Auto Recharge</h3>
                <CustomTooltip title="Automatically add credits to your account using your default payment method to keep deployments running.">
                  <InfoCircle className="h-4 w-4 cursor-pointer text-muted-foreground" />
                </CustomTooltip>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Switch checked={walletSettings?.autoReloadEnabled ?? false} onCheckedChange={toggleAutoReload} disabled={isReloadChangeDisabled} />
                {hasPaymentMethod ? (
                  <p className="text-sm text-muted-foreground">
                    Recharge amount is approximately{" "}
                    <span className="font-medium text-foreground">
                      <FormattedNumber value={weeklyCost ?? 0} style="currency" currency="USD" />
                    </span>{" "}
                    per week
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <Link href={UrlService.paymentMethods()} className="text-primary underline">
                      Add a payment method
                    </Link>{" "}
                    to enable auto recharge
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <PaymentSuccessAnimation
          show={showPaymentSuccess.show}
          amount={showPaymentSuccess.amount}
          onComplete={() => setShowPaymentSuccess({ amount: "", show: false })}
        />
      </div>

      {showPaymentPopup && (
        <PaymentPopup
          open={showPaymentPopup}
          onClose={() => setShowPaymentPopup(false)}
          selectedPaymentMethodId={defaultPaymentMethodId}
          setShowPaymentSuccess={setShowPaymentSuccess}
        />
      )}
    </div>
  );
};
