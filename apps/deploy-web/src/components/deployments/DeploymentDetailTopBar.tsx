"use client";
import { Dispatch, ReactNode, SetStateAction, useState } from "react";
import { Button, CustomTooltip, DropdownMenu, DropdownMenuContent, Switch } from "@akashnetwork/ui/components";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { formatDuration, intervalToDuration } from "date-fns";
import { Edit, MoreHoriz, NavArrowLeft, Refresh, Upload, XmarkSquare } from "iconoir-react";
import { useRouter } from "next/navigation";
import { event } from "nextjs-google-analytics";

import { CustomDropdownLinkItem } from "@src/components/shared/CustomDropdownLinkItem";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { usePricing } from "@src/context/PricingProvider/PricingProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { useUser } from "@src/hooks/useUser";
import { useDeploymentSettingQuery } from "@src/queries/deploymentSettingsQuery";
import { AnalyticsCategory, AnalyticsEvents } from "@src/types/analytics";
import { DeploymentDto } from "@src/types/deployment";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { UrlService } from "@src/utils/urlUtils";
import { DeploymentDepositModal } from "./DeploymentDepositModal";

type Props = {
  address: string;
  loadDeploymentDetail: () => void;
  removeLeases: () => void;
  setActiveTab: Dispatch<SetStateAction<string>>;
  deployment: DeploymentDto;
  children?: ReactNode;
};

export const DeploymentDetailTopBar: React.FunctionComponent<Props> = ({ address, loadDeploymentDetail, removeLeases, setActiveTab, deployment }) => {
  const { changeDeploymentName, getDeploymentData, getDeploymentName } = useLocalNotes();
  const { udenomToUsd } = usePricing();
  const router = useRouter();
  const { signAndBroadcastTx, isManaged } = useWallet();
  const [isDepositingDeployment, setIsDepositingDeployment] = useState(false);
  const storageDeploymentData = getDeploymentData(deployment?.dseq);
  const deploymentName = getDeploymentName(deployment?.dseq);
  const previousRoute = usePreviousRoute();
  const { closeDeploymentConfirm } = useManagedDeploymentConfirm();
  const user = useUser();
  const deploymentSetting = useDeploymentSettingQuery({ userId: user?.id, dseq: deployment.dseq });

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

      event(AnalyticsEvents.CLOSE_DEPLOYMENT, {
        category: AnalyticsCategory.DEPLOYMENTS,
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

      event(AnalyticsEvents.DEPLOYMENT_DEPOSIT, {
        category: AnalyticsCategory.DEPLOYMENTS,
        label: "Deposit deployment in deployment detail"
      });
    }
  };

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

            {isManaged && browserEnvConfig.NEXT_PUBLIC_AUTO_TOP_UP_ENABLED && (
              <div className="ml-4 flex items-center gap-2">
                <Switch checked={deploymentSetting.data?.autoTopUpEnabled} onCheckedChange={deploymentSetting.setAutoTopUpEnabled} />
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
