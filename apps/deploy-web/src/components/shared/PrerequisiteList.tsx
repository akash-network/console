"use client";
import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, Card, CardContent, Popup, Spinner } from "@akashnetwork/ui/components";
import { CheckCircle, WarningCircle } from "iconoir-react";

import { useChainParam } from "@src/context/ChainParamProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useTotalWalletBalance } from "@src/hooks/useWalletBalance";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { aktToUakt } from "@src/utils/priceUtils";
import { ConnectWallet } from "./ConnectWallet";
import { Title } from "./Title";

type Props = {
  onClose: () => void;
  onContinue: () => void;
};

export const PrerequisiteList: React.FunctionComponent<Props> = ({ onClose, onContinue }) => {
  const [isLoadingPrerequisites, setIsLoadingPrerequisites] = useState(false);
  const [isBalanceValidated, setIsBalanceValidated] = useState<boolean | null>(null);
  const { address, isManaged } = useWallet();
  const { walletBalance } = useTotalWalletBalance();
  const { minDeposit } = useChainParam();

  useEffect(() => {
    if (isManaged) {
      onContinue();
    }

    if (address && minDeposit.akt && minDeposit.usdc && !!walletBalance) {
      setIsLoadingPrerequisites(true);

      const isBalanceValidated = walletBalance?.balanceUAKT >= aktToUakt(minDeposit.akt) || walletBalance?.balanceUUSDC >= denomToUdenom(minDeposit.usdc);

      setIsBalanceValidated(isBalanceValidated);
      setIsLoadingPrerequisites(false);

      if (isBalanceValidated) {
        onContinue();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, walletBalance?.balanceUAKT, walletBalance?.balanceUUSDC, minDeposit.akt, minDeposit.usdc, isManaged]);

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      actions={[
        {
          label: "Close",
          color: "secondary",
          variant: "ghost",
          side: "left",
          onClick: onClose
        },
        {
          label: "Continue",
          color: "primary",
          variant: "default",
          side: "right",
          isLoading: isLoadingPrerequisites,
          onClick: onContinue
        }
      ]}
      hideCloseButton
      maxWidth="sm"
      enableCloseOnBackdropClick={false}
      title="Checking Prerequisites"
    >
      {address ? (
        <Card>
          <CardContent className="p-4">
            <ul className="space-y-4 pb-4 pt-0">
              <li className="flex items-center space-x-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {isBalanceValidated === null && <Spinner size="small" />}
                    {isBalanceValidated === true && <CheckCircle className="text-green-600" />}
                    {isBalanceValidated === false && <WarningCircle className="text-destructive" />}
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col">
                  <Title subTitle className="!text-lg">
                    Wallet Balance
                  </Title>
                  <p className="text-sm text-muted-foreground">
                    The balance of the wallet needs to be of at least {minDeposit.akt} AKT or {minDeposit.usdc} USDC. If you do not have {minDeposit.akt} AKT or{" "}
                    {minDeposit.usdc} USDC, you will need to specify an authorized depositor.
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      ) : (
        <div className="py-8">
          <ConnectWallet text="Setup your billing to deploy!" />
        </div>
      )}
    </Popup>
  );
};
