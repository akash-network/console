"use client";
import React from "react";
import { FormattedNumber } from "react-intl";
import { Alert, Popup } from "@akashnetwork/ui/components";
import { ArrowRight } from "iconoir-react";

import { useChainParam } from "@src/context/ChainParamProvider";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { usePopup } from "@akashnetwork/ui/context";

export const useManagedEscrowFaqModal = (): {
  showManagedEscrowFaqModal: () => void;
} => {
  const { minDeposit } = useChainParam();
  const { balance: walletBalance } = useWalletBalance();
  const { createCustom } = usePopup();

  const showManagedEscrowFaqModal = () => {
    createCustom({
      actions: [],
      fullWidth: true,
      title: "FAQ - Deployments",
      maxWidth: "sm",
      enableCloseOnBackdropClick: true,
      message: (
        <>
          {walletBalance && (
            <div className="mb-4 flex items-center space-x-2">
              <div className="flex items-center justify-between space-x-2">
                <span className="text-xs text-muted-foreground">Available:</span>
                <span className="font-bold">
                  <FormattedNumber
                    value={walletBalance.totalDeploymentGrantsUSD}
                    // eslint-disable-next-line react/style-prop-object
                    style="currency"
                    currency="USD"
                  />
                </span>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <span className="text-xs text-muted-foreground">Deposits:</span>
                <span>
                  <FormattedNumber
                    value={walletBalance.totalDeploymentEscrowUSD}
                    // eslint-disable-next-line react/style-prop-object
                    style="currency"
                    currency="USD"
                  />
                </span>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Alert className="space-y-2">
              <h2 className="font-bold">How do Akash deployments work?</h2>
              <p className="text-sm text-muted-foreground">
                Akash deployments use escrow accounts, also known as deployment deposits, as a way to ensure that a user has enough funds to cover the cost of
                deploying and running their application on the Akash network. When you create a deployment, you deposit{" "}
                <FormattedNumber
                  value={minDeposit.usdc}
                  // eslint-disable-next-line react/style-prop-object
                  style="currency"
                  currency="USD"
                />{" "}
                into the account.
              </p>

              <div>
                <span className="text-xs italic">Create deployment</span>
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-success">Available</span>
                  <span>{minDeposit.usdc}$</span>
                  <ArrowRight className="text-xs" />
                  <span>Deposit</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                This deposit acts as collateral and is used to pay for the resources consumed by your application. Akash charges by the minute and once you
                close your deployment, the remaining balance is transferred back to your available balance.
              </p>

              <div>
                <span className="text-xs italic">Close deployment</span>
                <div className="flex items-center space-x-2 text-sm">
                  <span>Deposit</span>
                  <span>{minDeposit.usdc}$</span>
                  <ArrowRight className="text-xs" />
                  <span className="text-success">Available</span>
                </div>
              </div>
            </Alert>

            <Alert className="space-y-2">
              <h2 className="font-bold">About Providers</h2>
              <p className="text-sm text-muted-foreground">
                Each provider has a unique configuration when it comes to escrow accounts. Withdrawals from the escrow account to the provider can be any value
                starting at 5 minutes. The cost stays the same, but the escrow balance of your deployments will be reduced by the amount withdrawn based on the
                provider configuration.
              </p>
            </Alert>
          </div>
        </>
      )
    });
  };
  return {
    showManagedEscrowFaqModal
  };
};
