"use client";
import type { ReactNode } from "react";
import React from "react";
import { useCallback, useState } from "react";
import { Button, CustomTooltip, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, Spinner, Switch } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import addHours from "date-fns/addHours";
import differenceInSeconds from "date-fns/differenceInSeconds";
import formatDuration from "date-fns/formatDuration";
import intervalToDuration from "date-fns/intervalToDuration";
import startOfHour from "date-fns/startOfHour";
import { Edit, MoreHoriz, NavArrowLeft, Refresh, Upload, XmarkSquare } from "iconoir-react";
import { useRouter } from "next/navigation";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { CustomDropdownLinkItem } from "@src/components/shared/CustomDropdownLinkItem";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useCurrencyFormatter } from "@src/hooks/useCurrencyFormatter/useCurrencyFormatter";
import { useDeploymentMetrics } from "@src/hooks/useDeploymentMetrics";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import { useDeploymentSettingQuery } from "@src/queries/deploymentSettingsQuery";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { averageBlockTime } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { UrlService } from "@src/utils/urlUtils";
import { DeploymentDepositModal } from "../DeploymentDepositModal/DeploymentDepositModal";

export const DEPENDENCIES = {
  Button,
  CustomTooltip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Spinner,
  Switch,
  CustomDropdownLinkItem,
  DeploymentDepositModal,
  useServices,
  useLocalNotes,
  useWallet,
  useCurrencyFormatter,
  useDeploymentMetrics,
  useManagedDeploymentConfirm,
  usePreviousRoute,
  usePricing,
  useDeploymentSettingQuery,
  usePopup,
  useRouter
};

type Props = {
  address: string;
  loadDeploymentDetail: () => void;
  removeLeases: () => void;
  onDeploymentClose: () => void;
  deployment: DeploymentDto;
  leases: LeaseDto[] | undefined | null;
  children?: ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const DeploymentDetailTopBar: React.FunctionComponent<Props> = ({
  address,
  loadDeploymentDetail,
  removeLeases,
  onDeploymentClose,
  deployment,
  leases,
  dependencies: d = DEPENDENCIES
}) => {
  const { analyticsService } = d.useServices();
  const { changeDeploymentName, getDeploymentData, getDeploymentName } = d.useLocalNotes();
  const { udenomToUsd } = d.usePricing();
  const router = d.useRouter();
  const wallet = d.useWallet();
  const [isDepositingDeployment, setIsDepositingDeployment] = useState(false);
  const storageDeploymentData = getDeploymentData(deployment?.dseq);
  const deploymentName = getDeploymentName(deployment?.dseq);
  const previousRoute = d.usePreviousRoute();
  const { closeDeploymentConfirm } = d.useManagedDeploymentConfirm();
  const deploymentSetting = d.useDeploymentSettingQuery({ dseq: deployment.dseq });
  const { realTimeLeft, deploymentCost } = d.useDeploymentMetrics({ deployment, leases });
  const { confirm } = d.usePopup();

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
    const response = await wallet.signAndBroadcastTx([message]);
    if (response) {
      onDeploymentClose();
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

  const onDeploymentDeposit = async (deposit: number) => {
    setIsDepositingDeployment(false);
    const message = TransactionMessageData.getDepositDeploymentMsg(
      address,
      address,
      deployment.dseq,
      deposit,
      deployment.escrowAccount.state.funds[0]?.denom || ""
    );
    const response = await wallet.signAndBroadcastTx([message]);
    if (response) {
      loadDeploymentDetail();

      analyticsService.track("deployment_deposit", {
        category: "deployments",
        label: "Deposit deployment in deployment detail"
      });
    }

    return response;
  };

  const formatCurrency = useCurrencyFormatter();
  const setAutoTopUpEnabled = useCallback(
    async (autoTopUpEnabled: boolean) => {
      if (autoTopUpEnabled && realTimeLeft?.timeLeft) {
        const secTillNextTopUp = differenceInSeconds(addHours(startOfHour(new Date()), 2), new Date());
        const secTillClosed = differenceInSeconds(realTimeLeft.timeLeft, new Date());

        if (secTillClosed < secTillNextTopUp) {
          const secToDepositFor = secTillNextTopUp - secTillClosed;
          const deposit = Math.ceil((deploymentCost * secToDepositFor) / averageBlockTime);

          const convertedDeposit = formatCurrency(udenomToUsd(deposit, deployment.escrowAccount.state.funds[0]?.denom || ""));
          const isConfirmed = await confirm({
            title: "Deposit required",
            message: `To enable auto top-up, please deposit ${convertedDeposit}. This ensures your deployment remains active until the next scheduled check.`
          });

          if (!isConfirmed) {
            return;
          }

          const isSuccess = await onDeploymentDeposit(deposit);

          if (!isSuccess) {
            return;
          }
        }
      }

      deploymentSetting.setAutoTopUpEnabled(autoTopUpEnabled);
    },
    [confirm, deployment.escrowAccount.state.funds, deploymentCost, deploymentSetting, formatCurrency, onDeploymentDeposit, realTimeLeft?.timeLeft, udenomToUsd]
  );

  return (
    <>
      <div className="flex items-center space-x-2 px-2 pb-2">
        <d.Button aria-label="back" onClick={handleBackClick} size="icon" variant="ghost">
          <NavArrowLeft />
        </d.Button>

        <h3 className="truncate text-2xl font-bold">{deploymentName ? deploymentName : "Deployment detail"}</h3>

        <d.Button aria-label="refresh" onClick={() => loadDeploymentDetail()} size="icon" variant="text">
          <Refresh />
        </d.Button>

        {deployment?.state === "active" && (
          <div className="flex items-center">
            <d.DropdownMenu modal={false}>
              <d.DropdownMenuTrigger asChild>
                <d.Button size="icon" variant="ghost" className="rounded-full" data-testid="deployment-detail-dropdown">
                  <MoreHoriz />
                </d.Button>
              </d.DropdownMenuTrigger>
              <d.DropdownMenuContent align="end">
                <d.CustomDropdownLinkItem
                  onClick={() => {
                    onChangeName();
                    analyticsService.track("edit_name_btn_clk", "Amplitude");
                  }}
                  icon={<Edit fontSize="small" />}
                >
                  Edit Name
                </d.CustomDropdownLinkItem>
                {storageDeploymentData?.manifest && (
                  <d.CustomDropdownLinkItem
                    onClick={() => {
                      redeploy();
                      analyticsService.track("redeploy_btn_clk", "Amplitude");
                    }}
                    icon={<Upload fontSize="small" />}
                  >
                    Redeploy
                  </d.CustomDropdownLinkItem>
                )}
                <d.CustomDropdownLinkItem
                  onClick={() => {
                    onCloseDeployment();
                    analyticsService.track("close_deployment_btn_clk", "Amplitude");
                  }}
                  icon={<XmarkSquare fontSize="small" />}
                  data-testid="deployment-detail-close-button"
                >
                  Close
                </d.CustomDropdownLinkItem>
              </d.DropdownMenuContent>
            </d.DropdownMenu>
            <d.Button
              variant="default"
              className="ml-2 whitespace-nowrap"
              onClick={() => {
                setIsDepositingDeployment(true);
                analyticsService.track("deposit_deployment_btn_clk", "Amplitude");
              }}
              size="sm"
            >
              Add funds
            </d.Button>

            {wallet.isManaged && (
              <div className="ml-4 flex items-center gap-2">
                <d.Switch checked={deploymentSetting.data?.autoTopUpEnabled} onCheckedChange={setAutoTopUpEnabled} disabled={deploymentSetting.isLoading} />
                <span>Auto top-up</span>
                <d.CustomTooltip
                  title={
                    <div className="space-y-2">
                      <div>
                        <div>Estimated amount: ${udenomToUsd(deploymentSetting.data?.estimatedTopUpAmount || 0, wallet.denom)}</div>
                        <div>Check period: {formatDuration(intervalToDuration({ start: 0, end: deploymentSetting.data?.topUpFrequencyMs || 0 }))}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Auto top-up will only occur if there are insufficient funds to maintain the deployment until the next scheduled check.
                      </div>
                    </div>
                  }
                >
                  <span className="cursor-help text-muted-foreground">ⓘ</span>
                </d.CustomTooltip>
                {deploymentSetting.isLoading && <d.Spinner size="small" />}
              </div>
            )}
          </div>
        )}

        {deployment?.state === "closed" && (
          <div className="flex items-center space-x-2">
            <d.Button
              onClick={() => {
                onChangeName();
                analyticsService.track("edit_name_btn_clk", "Amplitude");
              }}
              variant="default"
              className="whitespace-nowrap"
              color="secondary"
              size="sm"
            >
              <Edit fontSize="small" />
              &nbsp;Edit Name
            </d.Button>

            {storageDeploymentData?.manifest && (
              <d.Button
                onClick={() => {
                  redeploy();
                  analyticsService.track("redeploy_btn_clk", "Amplitude");
                }}
                variant="default"
                className="whitespace-nowrap"
                color="secondary"
                size="sm"
              >
                <Upload fontSize="small" />
                &nbsp;Redeploy
              </d.Button>
            )}
          </div>
        )}
      </div>

      {isDepositingDeployment && (
        <d.DeploymentDepositModal
          denom={deployment.escrowAccount.state.funds[0]?.denom || ""}
          disableMin
          handleCancel={() => setIsDepositingDeployment(false)}
          onDeploymentDeposit={onDeploymentDeposit}
        />
      )}
    </>
  );
};
