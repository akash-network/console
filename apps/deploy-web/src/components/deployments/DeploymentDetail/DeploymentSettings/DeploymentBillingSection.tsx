"use client";
import type { FC } from "react";
import { useCallback, useState } from "react";
import { Button, CustomTooltip, Snackbar, Spinner, Switch } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import formatDuration from "date-fns/formatDuration";
import intervalToDuration from "date-fns/intervalToDuration";
import { InfoCircle } from "iconoir-react";
import { useSnackbar } from "notistack";

import { PriceValue } from "@src/components/shared/PriceValue";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useAutoTopUp } from "@src/hooks/useAutoTopUp/useAutoTopUp";
import { useDeploymentEscrowBalance } from "@src/hooks/useDeploymentEscrowBalance/useDeploymentEscrowBalance";
import { useFlag } from "@src/hooks/useFlag";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import { useTickingNow } from "@src/hooks/useTickingNow";
import { useUpdateDeploymentSettingMutation } from "@src/queries/deploymentSettingsQuery";
import type { AppError } from "@src/types";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { extractErrorMessage } from "@src/utils/errorUtils";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { formatRuntimeLimit } from "@src/utils/runtimeLimitUtils";
import { DeploymentDepositModal } from "../../DeploymentDepositModal/DeploymentDepositModal";
import { AddRuntimeHoursModal } from "./AddRuntimeHoursModal";

export const DEPENDENCIES = {
  useServices,
  useWallet,
  useFlag,
  usePopup,
  usePricing,
  useAutoTopUp,
  useDeploymentEscrowBalance,
  useUpdateDeploymentSettingMutation,
  useTickingNow,
  useSnackbar,
  Snackbar,
  DeploymentDepositModal,
  AddRuntimeHoursModal,
  PriceValue,
  CustomTooltip
};

export interface DeploymentBillingSectionProps {
  deployment: DeploymentDto;
  leases: LeaseDto[] | null | undefined;
  onFundsChanged: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentBillingSection: FC<DeploymentBillingSectionProps> = ({ deployment, leases, onFundsChanged, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = d.useServices();
  const { denom: walletDenom } = d.useWallet();
  const { udenomToUsd } = d.usePricing();
  const { confirm } = d.usePopup();
  const { enqueueSnackbar } = d.useSnackbar();
  const isEscrowAbstracted = d.useFlag("auto_reload_fixed_threshold");
  const [isDepositing, setIsDepositing] = useState(false);
  const [isAddingHours, setIsAddingHours] = useState(false);
  const isActive = deployment.state === "active";

  const onDeposited = useCallback(() => {
    analyticsService.track("deployment_deposit", { category: "deployments", label: "Deposit deployment in deployment detail" });
    onFundsChanged();
  }, [analyticsService, onFundsChanged]);

  const { isEnabled, isLoading, estimatedTopUpAmount, topUpFrequencyMs, runtimeLimitHours, runtimeEndsAt, costPerBlockUdenom, setEnabled, deposit } =
    d.useAutoTopUp({ deployment, leases, onDeposited });
  const { balanceUdenom, denom: escrowDenom } = d.useDeploymentEscrowBalance({ deployment, leases });
  const updateSetting = d.useUpdateDeploymentSettingMutation({ dseq: deployment.dseq });

  const isRuntimeLimited = !!runtimeLimitHours;
  const now = d.useTickingNow(!!runtimeEndsAt);

  const openDepositModal = useCallback(() => {
    setIsDepositing(true);
    analyticsService.track("deposit_deployment_btn_clk", "Amplitude");
  }, [analyticsService]);

  const submitDeposit = useCallback(
    (amount: number) => {
      setIsDepositing(false);
      deposit(amount);
    },
    [deposit]
  );

  const openAddHoursModal = useCallback(() => {
    setIsAddingHours(true);
    analyticsService.track("add_runtime_hours_btn_clk", "Amplitude");
  }, [analyticsService]);

  /**
   * Reloads the deployment on success because a new limit shifts the deadline the countdown reads, and
   * the extension is funded right away so the escrow balance moves too. The API's message is surfaced
   * verbatim: it is the one that explains which bound the request broke.
   */
  const submitAddedHours = useCallback(
    async (totalHours: number) => {
      try {
        await updateSetting.mutateAsync({ runtimeLimitHours: totalHours });
        setIsAddingHours(false);
        analyticsService.track("add_runtime_hours", { category: "deployments", label: "Extend runtime limit in deployment settings" });
        onFundsChanged();
      } catch (error) {
        enqueueSnackbar(<d.Snackbar title="Couldn't add runtime hours" subTitle={extractErrorMessage(error as AppError)} iconVariant="error" />, {
          variant: "error"
        });
      }
    },
    [analyticsService, d, enqueueSnackbar, onFundsChanged, updateSetting]
  );

  /**
   * Drops the runtime limit for good, so it asks first: the deployment then funds itself until the user
   * closes it, and nothing here offers a way back to a fixed runtime. Auto top-up is turned on with it,
   * because that is what keeps an always-on deployment alive.
   */
  const switchToAlwaysOn = useCallback(async () => {
    analyticsService.track("remove_runtime_limit_btn_clk", "Amplitude");

    const isConfirmed = await confirm({
      title: "Switch to always on?",
      message: "This deployment will keep topping up automatically until you close it. You can't switch back to a fixed runtime."
    });

    if (!isConfirmed) return;

    try {
      await updateSetting.mutateAsync({ runtimeLimitHours: null, autoTopUpEnabled: true });
      analyticsService.track("remove_runtime_limit", { category: "deployments", label: "Switch a limited deployment to always on" });
      onFundsChanged();
    } catch (error) {
      enqueueSnackbar(<d.Snackbar title="Couldn't switch to always on" subTitle={extractErrorMessage(error as AppError)} iconVariant="error" />, {
        variant: "error"
      });
    }
  }, [analyticsService, confirm, d, enqueueSnackbar, onFundsChanged, updateSetting]);

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          {!isEscrowAbstracted && (
            <>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Current balance</div>
              <div className="text-2xl font-bold">
                <d.PriceValue denom={escrowDenom} value={udenomToDenom(balanceUdenom, 6)} />
              </div>
            </>
          )}
          {isRuntimeLimited && <div className="text-sm text-muted-foreground">Runtime limit: {formatRuntimeLimit(runtimeLimitHours, runtimeEndsAt, now)}</div>}
        </div>
        {isActive && (isRuntimeLimited || !isEscrowAbstracted) && (
          <Button variant="outline" size="md" onClick={isRuntimeLimited ? openAddHoursModal : openDepositModal}>
            {isRuntimeLimited ? "Add hours" : "Add funds"}
          </Button>
        )}
      </div>

      {isActive && isRuntimeLimited && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <div className="space-y-1">
            <div className="font-medium">Runtime limit</div>
            <p className="text-sm text-muted-foreground">
              This deployment closes automatically once its limit is reached. Switching to always on keeps it funded until you close it, and can&apos;t be
              undone.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {updateSetting.isPending && <Spinner size="small" />}
            <Button variant="outline" size="md" onClick={switchToAlwaysOn} disabled={updateSetting.isPending}>
              Switch to always on
            </Button>
          </div>
        </div>
      )}

      {!isEscrowAbstracted && isActive && !isRuntimeLimited && (
        <div className="mt-6 flex items-center justify-between gap-4 border-t pt-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium">
              Auto Top-Up
              <d.CustomTooltip
                title={
                  <div className="space-y-2">
                    <div>
                      <div>Estimated amount: ${udenomToUsd(estimatedTopUpAmount, walletDenom)}</div>
                      <div>Check period: {formatDuration(intervalToDuration({ start: 0, end: topUpFrequencyMs }))}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Auto top-up will only occur if there are insufficient funds to maintain the deployment until the next scheduled check.
                    </div>
                  </div>
                }
              >
                <InfoCircle width={14} height={14} className="text-muted-foreground" />
              </d.CustomTooltip>
            </div>
            <p className="text-sm text-muted-foreground">Automatically add funds when your balance gets low to keep this deployment running.</p>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && <Spinner size="small" />}
            <Switch checked={isEnabled} onCheckedChange={setEnabled} disabled={isLoading} aria-label="Auto Top-Up" />
          </div>
        </div>
      )}

      {!isEscrowAbstracted && isDepositing && (
        <d.DeploymentDepositModal denom={escrowDenom} disableMin onCancel={() => setIsDepositing(false)} onSubmit={submitDeposit} />
      )}

      {isAddingHours && isRuntimeLimited && (
        <d.AddRuntimeHoursModal
          currentLimitHours={runtimeLimitHours}
          costPerBlockUdenom={costPerBlockUdenom}
          denom={escrowDenom}
          isSubmitting={updateSetting.isPending}
          onCancel={() => setIsAddingHours(false)}
          onSubmit={submitAddedHours}
        />
      )}
    </div>
  );
};
