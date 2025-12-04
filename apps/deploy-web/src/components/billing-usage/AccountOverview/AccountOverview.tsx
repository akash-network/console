import React, { useCallback, useMemo, useState } from "react";
import { FormattedNumber } from "react-intl";
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Snackbar, Switch } from "@akashnetwork/ui/components";
import { LinearProgress } from "@mui/material";
import { Plus } from "iconoir-react";
import { useSnackbar } from "notistack";

import { PaymentPopup } from "@src/components/billing-usage/PaymentPopup/PaymentPopup";
import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { PaymentSuccessAnimation } from "@src/components/user/payment/PaymentSuccessAnimation";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useDefaultPaymentMethodQuery, useWalletSettingsMutations, useWalletSettingsQuery } from "@src/queries";

export const AccountOverview: React.FunctionComponent = () => {
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState<{ amount: string; show: boolean }>({ amount: "", show: false });
  const { enqueueSnackbar } = useSnackbar();
  const { data: defaultPaymentMethod, isLoading: isLoadingDefaultPaymentMethod } = useDefaultPaymentMethodQuery();
  const { balance: walletBalance, isLoading: isWalletBalanceLoading } = useWalletBalance();
  const { data: walletSettings } = useWalletSettingsQuery();
  const { updateWalletSettings, createWalletSettings } = useWalletSettingsMutations();

  const isLoading = isLoadingDefaultPaymentMethod;

  const defaultPaymentMethodId = useMemo(() => {
    return defaultPaymentMethod?.id;
  }, [defaultPaymentMethod]);

  const toggleAutoReload = useCallback(
    async (autoReloadEnabled: boolean) => {
      try {
        const settings = {
          autoReloadEnabled
        };

        if (walletSettings) {
          await updateWalletSettings.mutateAsync(settings);
        } else {
          await createWalletSettings.mutateAsync(settings);
        }

        enqueueSnackbar(<Snackbar title={`Auto Reload ${autoReloadEnabled ? "enabled" : "disabled"}`} iconVariant="success" />, {
          variant: "success",
          autoHideDuration: 3000
        });
      } catch (error: unknown) {
        enqueueSnackbar(<Snackbar title="Failed to update Auto Reload settings" iconVariant="error" />, { variant: "error" });
      }
    },
    [createWalletSettings, enqueueSnackbar, updateWalletSettings, walletSettings]
  );

  const isReloadChangeDisabled = useMemo(() => {
    return !defaultPaymentMethod || updateWalletSettings.isPending || createWalletSettings.isPending;
  }, [defaultPaymentMethod, updateWalletSettings.isPending, createWalletSettings.isPending]);

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
          <Card className="flex min-h-28 basis-1/2 flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <CardTitle className="text-base">Credits Remaining</CardTitle>
            </CardHeader>
            {!walletBalance || isWalletBalanceLoading ? (
              <div className="flex flex-1 items-center">
                <LinearProgress color="primary" className="mx-auto w-11/12" />
              </div>
            ) : (
              <>
                <CardContent className="pb-0">
                  <div className="mt-4 text-3xl font-bold">
                    <FormattedNumber value={walletBalance.totalDeploymentGrantsUSD} style="currency" currency="USD" />
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
              </>
            )}
          </Card>
          <Card className="flex min-h-28 basis-1/2 flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <CardTitle className="text-base">Auto reload</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div>
                <div className="pt-4">
                  <Switch checked={walletSettings?.autoReloadEnabled ?? false} onCheckedChange={toggleAutoReload} disabled={isReloadChangeDisabled} />
                </div>
                <div className="pt-2 text-sm">Add funds automatically</div>
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
