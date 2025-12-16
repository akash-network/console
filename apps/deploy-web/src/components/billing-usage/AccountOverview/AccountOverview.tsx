import React, { useCallback, useMemo, useState } from "react";
import { FormattedNumber } from "react-intl";
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Snackbar, Switch } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { LinearProgress } from "@mui/material";
import { Plus } from "iconoir-react";
import { useSnackbar } from "notistack";

import { PaymentPopup } from "@src/components/billing-usage/PaymentPopup/PaymentPopup";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { PaymentSuccessAnimation } from "@src/components/user/payment/PaymentSuccessAnimation";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDefaultPaymentMethodQuery, useWalletSettingsMutations, useWalletSettingsQuery, useWeeklyDeploymentCostQuery } from "@src/queries";

export const AccountOverview: React.FunctionComponent = () => {
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState<{ amount: string; show: boolean }>({ amount: "", show: false });
  const { enqueueSnackbar } = useSnackbar();
  const { data: defaultPaymentMethod, isLoading: isLoadingDefaultPaymentMethod } = useDefaultPaymentMethodQuery();
  const { balance: walletBalance, isLoading: isWalletBalanceLoading } = useWalletBalance();
  const { data: walletSettings } = useWalletSettingsQuery();
  const { data: weeklyCost, isLoading: isWeeklyCostLoading } = useWeeklyDeploymentCostQuery();
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

  const isReloadChangeDisabled = useMemo(() => {
    return !defaultPaymentMethod || upsertWalletSettings.isPending;
  }, [defaultPaymentMethod, upsertWalletSettings.isPending]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading payment information...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <div>
      <Title subTitle>Account overview</Title>

      <div className="pt-4">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:gap-8">
          <Card className="relative flex min-h-28 basis-1/2 flex-col overflow-hidden">
            {(!walletBalance || isWalletBalanceLoading) && (
              <div className="absolute left-0 right-0 top-0 flex flex-1 items-center">
                <LinearProgress color="primary" className="mx-auto w-full" />
              </div>
            )}
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <CardTitle className="text-base">Credits Remaining</CardTitle>
            </CardHeader>
            <CardContent className="pb-0">
              <div className="mt-4 text-3xl font-bold">
                {walletBalance && <FormattedNumber value={walletBalance.totalDeploymentGrantsUSD} style="currency" currency="USD" />}
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                variant="default"
                size="icon"
                className="h-8 w-8 text-xs"
                onClick={() => setShowPaymentPopup(true)}
                disabled={isWalletBalanceLoading || !defaultPaymentMethod}
              >
                <Plus />
              </Button>
            </CardFooter>
          </Card>
          <Card className="relative flex min-h-28 basis-1/2 flex-col overflow-hidden">
            {upsertWalletSettings.isPending && (
              <div className="absolute left-0 right-0 top-0 flex flex-1 items-center">
                <LinearProgress color="primary" className="mx-auto w-full" />
              </div>
            )}
            <CardHeader className="flex items-start justify-between pb-0">
              <CardTitle className="text-base">Credits Auto Reload</CardTitle>
              <CardDescription className="space-y-2">Charges your default payment method ~weekly to keep deployments with auto top-up running</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div>
                <div className="flex flex-col gap-4 pt-4">
                  <div className="flex items-center justify-between">
                    <Switch checked={walletSettings?.autoReloadEnabled ?? false} onCheckedChange={toggleAutoReload} disabled={isReloadChangeDisabled} />
                  </div>
                  {!isWeeklyCostLoading && weeklyCost !== undefined && (
                    <div className="text-sm text-muted-foreground">
                      Ongoing auto-topped-up deployment cost is approximately{" "}
                      <span className="font-medium text-foreground">
                        <FormattedNumber value={weeklyCost} style="currency" currency="USD" />
                      </span>{" "}
                      per week
                    </div>
                  )}
                </div>
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
