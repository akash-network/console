"use client";
import type { ReactNode } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import isValid from "date-fns/isValid";
import { WarningCircle } from "iconoir-react";

import { CopyTextToClipboardButton } from "@src/components/shared/CopyTextToClipboardButton";
import { LabelValue } from "@src/components/shared/LabelValue";
import { PricePerTimeUnit } from "@src/components/shared/PricePerTimeUnit";
import { PriceValue } from "@src/components/shared/PriceValue";
import { StatusPill } from "@src/components/shared/StatusPill";
import { TrialDeploymentBadge } from "@src/components/shared/TrialDeploymentBadge";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useDeploymentMetrics } from "@src/hooks/useDeploymentMetrics";
import { useTrialDeploymentTimeRemaining } from "@src/hooks/useTrialDeploymentTimeRemaining";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { isLeaseLive } from "@src/utils/reclamationUtils";

type Props = {
  deployment: DeploymentDto;
  leases: LeaseDto[] | undefined | null;
  children?: ReactNode;
};

export const DeploymentSubHeader: React.FunctionComponent<Props> = ({ deployment, leases }) => {
  const { deploymentCost, realTimeLeft } = useDeploymentMetrics({ deployment, leases });
  const isActive = deployment.state === "active";
  const hasLeases = !!leases && leases.length > 0;
  const hasActiveLeases = hasLeases && leases.some(isLeaseLive);
  const hasGpu = leases?.some(l => isLeaseLive(l) && l.gpuAmount && l.gpuAmount > 0);
  const { isTrialing } = useWallet();
  const { publicConfig: appConfig } = useServices();

  const trialDuration = appConfig.NEXT_PUBLIC_TRIAL_DEPLOYMENTS_DURATION_HOURS;
  const { timeRemainingText: trialTimeRemaining } = useTrialDeploymentTimeRemaining({
    createdHeight: deployment.createdAt,
    trialDurationHours: trialDuration,
    averageBlockTime: 6
  });

  return (
    <div className="grid grid-cols-2 gap-6 p-6">
      <div>
        <LabelValue
          label="Balance"
          labelWidth="6rem"
          value={
            <div className="flex items-center space-x-2">
              <PriceValue
                denom={deployment.escrowAccount.state.funds[0]?.denom || ""}
                value={udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.escrow : deployment.escrowBalance, 6)}
              />

              {isActive && hasActiveLeases && !!realTimeLeft && realTimeLeft.escrow <= 0 && (
                <CustomTooltip title="Your deployment is out of funds and can be closed by your provider at any time now. You can add funds to keep active.">
                  <WarningCircle className="text-xs text-destructive" />
                </CustomTooltip>
              )}
            </div>
          }
        />
        <LabelValue
          label="Cost"
          labelWidth="6rem"
          value={
            !!deploymentCost && (
              <div className="flex items-center space-x-2">
                <PricePerTimeUnit
                  denom={deployment.escrowAccount.state.funds[0]?.denom || ""}
                  perBlockValue={udenomToDenom(deploymentCost, 10)}
                  showAsHourly={hasGpu}
                />
              </div>
            )
          }
        />
        <LabelValue
          label="Spent"
          labelWidth="6rem"
          value={
            <div className="flex items-center space-x-2">
              <PriceValue
                denom={deployment.escrowAccount.state.funds[0]?.denom || ""}
                value={udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.amountSpent : parseFloat(deployment.transferred.amount), 6)}
              />
            </div>
          }
        />
      </div>

      <div>
        <LabelValue
          label="Status"
          labelWidth="6rem"
          value={
            <div className="flex items-center space-x-2">
              <div>{deployment.state}</div>
              <StatusPill state={deployment.state} size="small" />

              {isTrialing && <TrialDeploymentBadge createdHeight={deployment.createdAt} />}
            </div>
          }
        />
        <LabelValue
          label="Time left"
          labelWidth="6rem"
          value={
            <div className="flex items-center space-x-2">
              {realTimeLeft && isValid(realTimeLeft?.timeLeft) && <span>~{formatDistanceToNow(realTimeLeft?.timeLeft)}</span>}
              {isTrialing && trialTimeRemaining && <span className="text-xs text-primary">(Trial: {trialTimeRemaining})</span>}
            </div>
          }
        />
        <LabelValue
          label="DSEQ"
          labelWidth="6rem"
          value={
            <div className="flex items-center space-x-2">
              <span>{deployment.dseq}</span>
              <CopyTextToClipboardButton value={deployment.dseq} />
            </div>
          }
        />
      </div>
    </div>
  );
};
