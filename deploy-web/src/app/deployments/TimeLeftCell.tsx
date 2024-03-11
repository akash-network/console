import { DeploymentDepositModal } from "@src/components/deploymentDetail/DeploymentDepositModal";
import { CustomTooltip } from "@src/components/shared/CustomTooltip";
import { useWallet } from "@src/context/WalletProvider";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { getTimeLeft, useRealTimeLeft } from "@src/utils/priceUtils";
import { DeploymentRowType } from "@src/utils/zod/deploymentRow";
import { Row } from "@tanstack/react-table";
import { differenceInCalendarDays, formatDistanceToNow, isValid } from "date-fns";
import { WarningCircle } from "iconoir-react";
import React, { useState } from "react";

type MyComponentProps = {
  row: Row<DeploymentRowType>;
};

export const TimeLeftCell: React.FC<MyComponentProps> = ({ row }) => {
  const [isDepositingDeployment, setIsDepositingDeployment] = useState(false);
  const isActive = row.original.status === "active";
  const hasLeases = row.original.leases.length > 0;
  const deploymentCost = hasLeases ? row.original.leases.reduce((prev, current) => prev + parseFloat(current.price.amount), 0) : 0;
  const realTimeLeft = useRealTimeLeft(
    deploymentCost,
    row.original.escrowBalance,
    parseFloat(row.original.escrowAccount.settled_at),
    row.original.createdHeight
  );
  const isValidTimeLeft = isActive && hasLeases && isValid(realTimeLeft?.timeLeft);
  const { address, signAndBroadcastTx } = useWallet();
  const timeLeft = getTimeLeft(deploymentCost, row.original.escrowBalance);
  const showTimeLeftWarning = differenceInCalendarDays(timeLeft, new Date()) < 7;

  // row.

  function onDepositClicked(e?: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {
    e?.preventDefault();
    e?.stopPropagation();
    setIsDepositingDeployment(true);
  }

  const onDeploymentDeposit = async (deposit, depositorAddress) => {
    setIsDepositingDeployment(false);

    try {
      const message = TransactionMessageData.getDepositDeploymentMsg(
        address,
        row.original.dseq,
        deposit,
        row.original.escrowAccount.balance.denom,
        depositorAddress
      );
      const response = await signAndBroadcastTx([message]);
      if (response) {
        // TODO Find a way to refresh the list
        // refreshDeployments();
        // event(AnalyticsEvents.DEPLOYMENT_DEPOSIT, {
        //   category: "deployments",
        //   label: "Deposit to deployment from list"
        // });
      }
    } catch (error) {
      throw error;
    }
  };

  return (
    <>
      {isActive && isDepositingDeployment && (
        <DeploymentDepositModal
          denom={row.original.escrowAccount.balance.denom}
          handleCancel={() => setIsDepositingDeployment(false)}
          onDeploymentDeposit={onDeploymentDeposit}
        />
      )}

      {isActive && isValidTimeLeft && realTimeLeft && (
        <div className="flex items-center">
          ~{formatDistanceToNow(realTimeLeft?.timeLeft)}
          {showTimeLeftWarning && (
            <CustomTooltip
              title={
                <>
                  Your deployment will close soon,{" "}
                  <a href="#" onClick={onDepositClicked}>
                    Add Funds
                  </a>{" "}
                  to keep it running.
                </>
              }
            >
              <WarningCircle className="ml-2 text-sm text-destructive-foreground" />
            </CustomTooltip>
          )}
        </div>
      )}
    </>
  );
};
