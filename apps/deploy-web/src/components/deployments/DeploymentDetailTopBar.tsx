"use client";
import { Dispatch, ReactNode, SetStateAction, useCallback, useState } from "react";
import { Button, CustomTooltip, DropdownMenu, DropdownMenuContent, Spinner, Switch } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import addHours from "date-fns/addHours";
import differenceInSeconds from "date-fns/differenceInSeconds";
import formatDuration from "date-fns/formatDuration";
import intervalToDuration from "date-fns/intervalToDuration";
import startOfHour from "date-fns/startOfHour";
import { Edit, MoreHoriz, NavArrowLeft, Refresh, Upload, XmarkSquare } from "iconoir-react";
import { useRouter } from "next/navigation";

import { CustomDropdownLinkItem } from "@src/components/shared/CustomDropdownLinkItem";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { usePricing } from "@src/context/PricingProvider/PricingProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useDeploymentMetrics } from "@src/hooks/useDeploymentMetrics";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { useUser } from "@src/hooks/useUser";
import { useDeploymentSettingQuery } from "@src/queries/deploymentSettingsQuery";
import { analyticsService } from "@src/services/analytics/analytics.service";
import { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { averageBlockTime } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { UrlService } from "@src/utils/urlUtils";
import { DeploymentDepositModal } from "./DeploymentDepositModal";

type Props = {
  address: string;
  loadDeploymentDetail: () => void;
  removeLeases: () => void;
  setActiveTab: Dispatch<SetStateAction<string>>;
  deployment: DeploymentDto;
  leases: LeaseDto[] | undefined | null;
  children?: ReactNode;
};

export const DeploymentDetailTopBar: React.FunctionComponent<Props> = ({ address, loadDeploymentDetail, removeLeases, setActiveTab, deployment, leases }) => {
  const { changeDeploymentName, getDeploymentData, getDeploymentName } = useLocalNotes();
  const { udenomToUsd } = usePricing();
  const router = useRouter();
  const { signAndBroadcastTx, isManaged, isTrialing } = useWallet();
  const [isDepositingDeployment, setIsDepositingDeployment] = useState(false);
  const storageDeploymentData = getDeploymentData(deployment?.dseq);
  const deploymentName = getDeploymentName(deployment?.dseq);
  const previousRoute = usePreviousRoute();
  const { closeDeploymentConfirm } = useManagedDeploymentConfirm();
  const user = useUser();
  const deploymentSetting = useDeploymentSettingQuery({ userId: user?.id, dseq: deployment.dseq });
  const { realTimeLeft, deploymentCost } = useDeploymentMetrics({ deployment, leases });
  const { confirm } = usePopup();

  function handleBackClick() {
    if (previousRoute) {
      router.back();
    } else {
      router.push(UrlService.deploymentList());
    }
  }

  const onCloseDeployment = async () => {
    const isConfirmed = await closeDeploymentConfirm([deployment.dseq]);

    if (!isConfirmed) {
      return;
    }

    const message = TransactionMessageData.getCloseDeploymentMsg(address, deployment.dseq);
    const response = await signAndBroadcastTx([message]);
    if (response) {
      setActiveTab("LEASES");
      removeLeases();
      loadDeploymentDetail();

      analyticsService.track("close_deployment", {
        category: "deployments",
        label: "Close deployment in deployment detail"
      });
    }
  };

  function onChangeName() {
    changeDeploymentName(deployment.dseq);
  }

  const redeploy = () => {
    const url = UrlService.newDeployment({ redeploy: deployment.dseq });
    router.push(url);
  };

  const onDeploymentDeposit = async (deposit: number, depositorAddress: string) => {
    setIsDepositingDeployment(false);
    const message = TransactionMessageData.getDepositDeploymentMsg(address, deployment.dseq, deposit, deployment.escrowAccount.balance.denom, depositorAddress);
    const response = await signAndBroadcastTx([message]);
    if (response) {
      loadDeploymentDetail();

      analyticsService.track("deployment_deposit", {
        category: "deployments",
        label: "Deposit deployment in deployment detail"
      });
    }

    return response;
  };

  const setAutoTopUpEnabled = useCallback(
    async (autoTopUpEnabled: boolean) => {
      if (autoTopUpEnabled && realTimeLeft?.timeLeft) {
        const secTillNextTopUp = differenceInSeconds(addHours(startOfHour(new Date()), 2), new Date());
        const secTillClosed = differenceInSeconds(realTimeLeft.timeLeft, new Date());

        if (secTillClosed < secTillNextTopUp) {
          const secToDepositFor = secTillNextTopUp - secTillClosed;
          const deposit = Math.ceil((deploymentCost * secToDepositFor) / averageBlockTime);

          const isConfirmed = await confirm({
            title: "Deposit required",
            message: `To enable auto top-up, please deposit $${udenomToUsd(deposit, deployment.escrowAccount.balance.denom)}. This ensures your deployment remains active until the next scheduled check.`
          });

          if (!isConfirmed) {
            return;
          }

          const isSuccess = await onDeploymentDeposit(deposit, browserEnvConfig.NEXT_PUBLIC_MASTER_WALLET_ADDRESS);

          if (!isSuccess) {
            return;
          }
        }
      }

      deploymentSetting.setAutoTopUpEnabled(autoTopUpEnabled);
    },
    [confirm, deployment.escrowAccount.balance.denom, deploymentCost, deploymentSetting, onDeploymentDeposit, realTimeLeft?.timeLeft, udenomToUsd]
  );

  return (
    <>
      <div className="flex items-center space-x-2 px-2 pb-2">
        <Button aria-label="back" onClick={handleBackClick} size="icon" variant="ghost">
          <NavArrowLeft />
        </Button>

        <h3 className="truncate text-2xl font-bold">{deploymentName ? deploymentName : "Deployment detail"}</h3>

        <Button aria-label="refresh" onClick={() => loadDeploymentDetail()} size="icon" variant="text">
          <Refresh />
        </Button>

        {deployment?.state === "active" && (
          <div className="flex items-center">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="rounded-full" data-testid="deployment-detail-dropdown">
                  <MoreHoriz />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <CustomDropdownLinkItem onClick={() => onChangeName()} icon={<Edit fontSize="small" />}>
                  Edit Name
                </CustomDropdownLinkItem>
                {storageDeploymentData?.manifest && (
                  <CustomDropdownLinkItem onClick={() => redeploy()} icon={<Upload fontSize="small" />}>
                    Redeploy
                  </CustomDropdownLinkItem>
                )}
                <CustomDropdownLinkItem
                  onClick={() => onCloseDeployment()}
                  icon={<XmarkSquare fontSize="small" />}
                  data-testid="deployment-detail-close-button"
                >
                  Close
                </CustomDropdownLinkItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="default" className="ml-2 whitespace-nowrap" onClick={() => setIsDepositingDeployment(true)} size="sm">
              Add funds
            </Button>

            {isManaged && !isTrialing && browserEnvConfig.NEXT_PUBLIC_AUTO_TOP_UP_ENABLED && (
              <div className="ml-4 flex items-center gap-2">
                <Switch checked={deploymentSetting.data?.autoTopUpEnabled} onCheckedChange={setAutoTopUpEnabled} disabled={deploymentSetting.isLoading} />
                <span>Auto top-up</span>
                <CustomTooltip
                  title={
                    <div className="space-y-2">
                      <div>
                        <div>
                          Estimated amount: ${udenomToUsd(deploymentSetting.data?.estimatedTopUpAmount || 0, browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_DENOM)}
                        </div>
                        <div>Check period: {formatDuration(intervalToDuration({ start: 0, end: deploymentSetting.data?.topUpFrequencyMs || 0 }))}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Auto top-up will only occur if there are insufficient funds to maintain the deployment until the next scheduled check.
                      </div>
                    </div>
                  }
                >
                  <span className="cursor-help text-muted-foreground">ⓘ</span>
                </CustomTooltip>
                {deploymentSetting.isLoading && <Spinner />}
              </div>
            )}
          </div>
        )}

        {deployment?.state === "closed" && (
          <div className="flex items-center space-x-2">
            <Button onClick={() => onChangeName()} variant="default" className="whitespace-nowrap" color="secondary" size="sm">
              <Edit fontSize="small" />
              &nbsp;Edit Name
            </Button>

            {storageDeploymentData?.manifest && (
              <Button onClick={() => redeploy()} variant="default" className="whitespace-nowrap" color="secondary" size="sm">
                <Upload fontSize="small" />
                &nbsp;Redeploy
              </Button>
            )}
          </div>
        )}
      </div>

      {isDepositingDeployment && (
        <DeploymentDepositModal
          denom={deployment.escrowAccount.balance.denom}
          disableMin
          handleCancel={() => setIsDepositingDeployment(false)}
          onDeploymentDeposit={onDeploymentDeposit}
        />
      )}
    </>
  );
};
