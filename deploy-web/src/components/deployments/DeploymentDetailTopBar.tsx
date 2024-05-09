"use client";
import { Dispatch, ReactNode, SetStateAction, useState } from "react";
import { DeploymentDepositModal } from "./DeploymentDepositModal";
import { useLocalNotes } from "@src/context/LocalNoteProvider";
import { useRouter } from "next/navigation";
import { UrlService } from "@src/utils/urlUtils";
import { useWallet } from "@src/context/WalletProvider";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { DeploymentDto } from "@src/types/deployment";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { Button } from "@src/components/ui/button";
import { Edit, MoreHoriz, NavArrowLeft, Refresh, Upload, XmarkSquare } from "iconoir-react";
import { DropdownMenu, DropdownMenuContent } from "@src/components/ui/dropdown-menu";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { CustomDropdownLinkItem } from "@src/components/shared/CustomDropdownLinkItem";

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
  const router = useRouter();
  const { signAndBroadcastTx } = useWallet();
  const [isDepositingDeployment, setIsDepositingDeployment] = useState(false);
  const storageDeploymentData = getDeploymentData(deployment?.dseq);
  const deploymentName = getDeploymentName(deployment?.dseq);
  const previousRoute = usePreviousRoute();

  function handleBackClick() {
    if (previousRoute) {
      router.back();
    } else {
      router.push(UrlService.deploymentList());
    }
  }

  const onCloseDeployment = async () => {
    try {
      const message = TransactionMessageData.getCloseDeploymentMsg(address, deployment.dseq);
      const response = await signAndBroadcastTx([message]);
      if (response) {
        setActiveTab("LEASES");
        removeLeases();
        loadDeploymentDetail();

        event(AnalyticsEvents.CLOSE_DEPLOYMENT, {
          category: "deployments",
          label: "Close deployment in deployment detail"
        });
      }
    } catch (error) {
      throw error;
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

    try {
      const message = TransactionMessageData.getDepositDeploymentMsg(
        address,
        deployment.dseq,
        deposit,
        deployment.escrowAccount.balance.denom,
        depositorAddress
      );
      const response = await signAndBroadcastTx([message]);
      if (response) {
        loadDeploymentDetail();

        event(AnalyticsEvents.DEPLOYMENT_DEPOSIT, {
          category: "deployments",
          label: "Deposit deployment in deployment detail"
        });
      }
    } catch (error) {
      throw error;
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
                <Button size="icon" variant="ghost" className="rounded-full">
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
                <CustomDropdownLinkItem onClick={() => onCloseDeployment()} icon={<XmarkSquare fontSize="small" />}>
                  Close
                </CustomDropdownLinkItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="default" className="ml-2 whitespace-nowrap" onClick={() => setIsDepositingDeployment(true)} size="sm">
              Add funds
            </Button>
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
