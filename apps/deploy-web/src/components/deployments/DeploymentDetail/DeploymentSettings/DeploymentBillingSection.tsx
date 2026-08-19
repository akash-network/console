"use client";
import type { FC } from "react";
import { useCallback, useState } from "react";
import { Button, CustomTooltip, Spinner, Switch } from "@akashnetwork/ui/components";
import formatDuration from "date-fns/formatDuration";
import intervalToDuration from "date-fns/intervalToDuration";
import { InfoCircle } from "iconoir-react";

import { PriceValue } from "@src/components/shared/PriceValue";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useAutoTopUp } from "@src/hooks/useAutoTopUp/useAutoTopUp";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { getEscrowDenom } from "@src/utils/deploymentUtils";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { DeploymentDepositModal } from "../../DeploymentDepositModal/DeploymentDepositModal";

export const DEPENDENCIES = {
  useServices,
  useWallet,
  usePricing,
  useAutoTopUp,
  DeploymentDepositModal,
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
  const [isDepositing, setIsDepositing] = useState(false);
  const isActive = deployment.state === "active";
  const hasActiveLeases = !!leases && leases.some(isLeaseLive);
  const escrowDenom = getEscrowDenom(deployment);

  const onDeposited = useCallback(() => {
    analyticsService.track("deployment_deposit", { category: "deployments", label: "Deposit deployment in deployment detail" });
    onFundsChanged();
  }, [analyticsService, onFundsChanged]);

  const { isEnabled, isLoading, estimatedTopUpAmount, topUpFrequencyMs, realTimeLeft, setEnabled, deposit } = d.useAutoTopUp({
    deployment,
    leases,
    onDeposited
  });
  const currentBalance = isActive && hasActiveLeases && realTimeLeft ? realTimeLeft.escrow : deployment.escrowBalance;

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

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Current balance</div>
          <div className="text-2xl font-bold">
            <d.PriceValue denom={escrowDenom} value={udenomToDenom(currentBalance, 6)} />
          </div>
        </div>
        {isActive && (
          <Button variant="outline" size="md" onClick={openDepositModal}>
            Add funds
          </Button>
        )}
      </div>

      {isActive && (
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

      {isDepositing && <d.DeploymentDepositModal denom={escrowDenom} disableMin onCancel={() => setIsDepositing(false)} onSubmit={submitDeposit} />}
    </div>
  );
};
