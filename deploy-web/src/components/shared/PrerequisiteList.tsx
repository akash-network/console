"use client";
import React, { useEffect, useState } from "react";
import { useWallet } from "@src/context/WalletProvider";
import { ConnectWallet } from "./ConnectWallet";
import { Popup } from "./Popup";
import { Card, CardContent } from "../ui/card";
import Spinner from "./Spinner";
import { CheckCircle, WarningCircle } from "iconoir-react";
import { useChainParam } from "@src/context/ChainParamProvider";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";

type Props = {
  onClose: () => void;
  onContinue: () => void;
};

export const PrerequisiteList: React.FunctionComponent<Props> = ({ onClose, onContinue }) => {
  const [isLoadingPrerequisites, setIsLoadingPrerequisites] = useState(false);
  const [isBalanceValidated, setIsBalanceValidated] = useState<boolean | null>(null);
  const { address, walletBalances, refreshBalances } = useWallet();
  const { minDeposit } = useChainParam();

  useEffect(() => {
    async function loadPrerequisites() {
      setIsLoadingPrerequisites(true);

      const balance = await refreshBalances();
      const isBalanceValidated = balance.uakt >= 5000000 || balance.usdc >= 5000000;

      setIsBalanceValidated(isBalanceValidated);
      setIsLoadingPrerequisites(false);

      if (isBalanceValidated) {
        onContinue();
      }
    }

    if (address) {
      loadPrerequisites();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletBalances?.uakt, walletBalances?.usdc]);

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
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick={false}
      title="Checking Prerequisites"
    >
      {address ? (
        <Card>
          <CardContent className="p-4">
            <ul className="space-y-4 pb-4 pt-0">
              <li className="flex items-center">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {isBalanceValidated === null && <Spinner size="medium" />}
                    {isBalanceValidated === true && <CheckCircle className="text-green-600" />}
                    {isBalanceValidated === false && <WarningCircle className="text-destructive" />}
                  </AvatarFallback>
                </Avatar>

                <div className="ml-4 flex flex-col">
                  <p className="text-xl">Wallet Balance</p>
                  <p className="text-muted-foreground">
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
          <ConnectWallet text="Connect your wallet to deploy!" />
        </div>
      )}
    </Popup>
  );
};
