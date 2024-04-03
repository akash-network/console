"use client";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import isValid from "date-fns/isValid";
import { getAvgCostPerMonth, useRealTimeLeft } from "@src/utils/priceUtils";
import { ReactNode } from "react";
import { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { LabelValue } from "@src/components/shared/LabelValue";
import { PriceValue } from "@src/components/shared/PriceValue";
import { CustomTooltip } from "@src/components/shared/CustomTooltip";
import { PricePerMonth } from "@src/components/shared/PricePerMonth";
import { StatusPill } from "@src/components/shared/StatusPill";
import { Info } from "lucide-react";
import { WarningCircle } from "iconoir-react";

type Props = {
  deployment: DeploymentDto;
  leases: LeaseDto[] | undefined | null;
  children?: ReactNode;
};

export const DeploymentSubHeader: React.FunctionComponent<Props> = ({ deployment, leases }) => {
  const hasLeases = leases && leases.length > 0;
  const deploymentCost = hasLeases ? leases.reduce((prev, current) => prev + parseFloat(current.price.amount), 0) : 0;
  const realTimeLeft = useRealTimeLeft(deploymentCost, deployment.escrowBalance, parseFloat(deployment.escrowAccount.settled_at), deployment.createdAt);
  const avgCost = udenomToDenom(getAvgCostPerMonth(deploymentCost));
  const isActive = deployment.state === "active";
  const hasActiveLeases = hasLeases && leases.some(l => l.state === "active");
  const denomData = useDenomData(deployment.escrowAccount.balance.denom);

  return (
    <div
      className="grid grid-cols-2 gap-4 p-4"
      // sx={{
      //   gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(2,1fr)", md: "repeat(2,1fr)" },
      //   display: "grid",
      //   gap: { xs: "1rem", sm: "1rem", md: "1rem" },
      //   padding: "1rem"
      // }}
    >
      <div>
        <LabelValue
          label="Balance"
          labelWidth="6rem"
          value={
            <div className="flex items-center">
              <PriceValue
                denom={deployment.escrowAccount.balance.denom}
                value={udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.escrow : deployment.escrowBalance, 6)}
              />
              <CustomTooltip
                title={
                  <>
                    <strong>
                      {udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.escrow : deployment.escrowBalance, 6)}&nbsp;{denomData?.label}
                    </strong>
                    <br />
                    The escrow account balance will be fully returned to your wallet balance when the deployment is closed.{" "}
                  </>
                }
              >
                <Info className="ml-2 text-xs text-muted-foreground" />
              </CustomTooltip>

              {isActive && hasActiveLeases && !!realTimeLeft && realTimeLeft.escrow <= 0 && (
                <CustomTooltip title="Your deployment is out of funds and can be closed by your provider at any time now. You can add funds to keep active.">
                  <WarningCircle className="ml-2 text-destructive" />
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
              <div className="flex items-center">
                <PricePerMonth denom={deployment.escrowAccount.balance.denom} perBlockValue={udenomToDenom(deploymentCost, 10)} />

                <CustomTooltip
                  title={
                    <span>
                      {avgCost} {denomData?.label} / month
                    </span>
                  }
                >
                  <Info className="ml-2 text-xs text-muted-foreground" />
                </CustomTooltip>
              </div>
            )
          }
        />
        <LabelValue
          label="Spent"
          labelWidth="6rem"
          value={
            <div className="flex items-center">
              <PriceValue
                denom={deployment.escrowAccount.balance.denom}
                value={udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.amountSpent : parseFloat(deployment.transferred.amount), 6)}
              />

              <CustomTooltip
                title={
                  <span>
                    {udenomToDenom(isActive && hasActiveLeases && realTimeLeft ? realTimeLeft?.amountSpent : parseFloat(deployment.transferred.amount), 6)}{" "}
                    {denomData?.label}
                  </span>
                }
              >
                <Info className="ml-2 text-xs text-muted-foreground" />
              </CustomTooltip>
            </div>
          }
        />
      </div>

      <div>
        <LabelValue
          label="Status"
          labelWidth="6rem"
          value={
            <div className="flex items-center">
              <div>{deployment.state}</div>
              <StatusPill state={deployment.state} style={{ marginLeft: ".5rem" }} />
            </div>
          }
        />
        <LabelValue
          label="Time left"
          labelWidth="6rem"
          value={realTimeLeft && isValid(realTimeLeft?.timeLeft) && `~${formatDistanceToNow(realTimeLeft?.timeLeft)}`}
        />
        <LabelValue label="DSEQ" labelWidth="6rem" value={deployment.dseq} />
      </div>
    </div>
  );
};
