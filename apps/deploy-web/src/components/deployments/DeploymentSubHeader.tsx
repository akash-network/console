"use client";
import type { ReactNode } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import isValid from "date-fns/isValid";
import { InfoCircle, WarningCircle } from "iconoir-react";

import { LabelValue } from "@src/components/shared/LabelValue";
import { PricePerMonth } from "@src/components/shared/PricePerMonth";
import { PriceValue } from "@src/components/shared/PriceValue";
import { StatusPill } from "@src/components/shared/StatusPill";
import { useWallet } from "@src/context/WalletProvider";
import { useDeploymentMetrics } from "@src/hooks/useDeploymentMetrics";
import { useFlag } from "@src/hooks/useFlag";
import { useDenomData } from "@src/hooks/useWalletBalance";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { getAvgCostPerMonth } from "@src/utils/priceUtils";
import { TrialDeploymentBadge } from "../shared";
import { CopyTextToClipboardButton } from "../shared/CopyTextToClipboardButton";

type Props = {
  deployment: DeploymentDto;
  leases: LeaseDto[] | undefined | null;
  children?: ReactNode;
};

export const DeploymentSubHeader: React.FunctionComponent<Props> = ({ deployment, leases }) => {
  const { deploymentCost, realTimeLeft } = useDeploymentMetrics({ deployment, leases });
  const avgCost = udenomToDenom(getAvgCostPerMonth(deploymentCost));
  const isActive = deployment.state === "active";
  const hasLeases = !!leases && leases.length > 0;
  const hasActiveLeases = hasLeases && leases.some(l => l.state === "active");
  const denomData = useDenomData(deployment.escrowAccount.balance.denom);
  const { isCustodial, isTrialing } = useWallet();
  const isAnonymousFreeTrialEnabled = useFlag("anonymous_free_trial");
  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      <div>
        <LabelValue
          label="Balance"
          labelWidth="6rem"
          value={
            <div className="flex items-center space-x-2">
              <PriceValue
                denom={deployment.escrowAccount.balance.denom}
                value={udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.escrow : deployment.escrowBalance, 6)}
              />
              {isCustodial && (
                <CustomTooltip
                  title={
                    <>
                      <strong>
                        {udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.escrow : deployment.escrowBalance, 6)}&nbsp;
                        {denomData?.label}
                      </strong>
                      <br />
                      The escrow account balance will be fully returned to your wallet balance when the deployment is closed.{" "}
                    </>
                  }
                >
                  <InfoCircle className="text-xs text-muted-foreground" />
                </CustomTooltip>
              )}

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
                <PricePerMonth denom={deployment.escrowAccount.balance.denom} perBlockValue={udenomToDenom(deploymentCost, 10)} />

                {isCustodial && (
                  <CustomTooltip
                    title={
                      <span>
                        {avgCost} {denomData?.label} / month
                      </span>
                    }
                  >
                    <InfoCircle className="text-xs text-muted-foreground" />
                  </CustomTooltip>
                )}
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
                denom={deployment.escrowAccount.balance.denom}
                value={udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.amountSpent : parseFloat(deployment.transferred.amount), 6)}
              />

              {isCustodial && (
                <CustomTooltip
                  title={
                    <span>
                      {udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.amountSpent : parseFloat(deployment.transferred.amount), 6)}{" "}
                      {denomData?.label}
                    </span>
                  }
                >
                  <InfoCircle className="text-xs text-muted-foreground" />
                </CustomTooltip>
              )}
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

              {!isAnonymousFreeTrialEnabled && isTrialing && <TrialDeploymentBadge createdHeight={deployment.createdAt} />}
            </div>
          }
        />
        <LabelValue
          label="Time left"
          labelWidth="6rem"
          value={realTimeLeft && isValid(realTimeLeft?.timeLeft) && `~${formatDistanceToNow(realTimeLeft?.timeLeft)}`}
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
