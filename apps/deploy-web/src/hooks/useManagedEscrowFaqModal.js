"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useManagedEscrowFaqModal = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var context_1 = require("@akashnetwork/ui/context");
var iconoir_react_1 = require("iconoir-react");
var ChainParamProvider_1 = require("@src/context/ChainParamProvider");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var useManagedEscrowFaqModal = function () {
    var minDeposit = (0, ChainParamProvider_1.useChainParam)().minDeposit;
    var walletBalance = (0, useWalletBalance_1.useWalletBalance)().balance;
    var createCustom = (0, context_1.usePopup)().createCustom;
    var showManagedEscrowFaqModal = function () {
        createCustom({
            actions: [],
            fullWidth: true,
            title: "FAQ - Deployments",
            maxWidth: "sm",
            enableCloseOnBackdropClick: true,
            message: (<>
          {walletBalance && (<div className="mb-4 flex items-center space-x-2">
              <div className="flex items-center justify-between space-x-2">
                <span className="text-xs text-muted-foreground">Available:</span>
                <span className="font-bold">
                  <react_intl_1.FormattedNumber value={walletBalance.totalDeploymentGrantsUSD - walletBalance.totalDeploymentEscrowUSD} 
                // eslint-disable-next-line react/style-prop-object
                style="currency" currency="USD"/>
                </span>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <span className="text-xs text-muted-foreground">Deposits:</span>
                <span>
                  <react_intl_1.FormattedNumber value={walletBalance.totalDeploymentEscrowUSD} 
                // eslint-disable-next-line react/style-prop-object
                style="currency" currency="USD"/>
                </span>
              </div>
            </div>)}
          <div className="space-y-2">
            <components_1.Alert className="space-y-2">
              <h2 className="font-bold">How do Akash deployments work?</h2>
              <p className="text-sm text-muted-foreground">
                Akash deployments use escrow accounts, also known as deployment deposits, as a way to ensure that a user has enough funds to cover the cost of
                deploying and running their application on the Akash network. When you create a deployment, you deposit{" "}
                <react_intl_1.FormattedNumber value={minDeposit.usdc} 
            // eslint-disable-next-line react/style-prop-object
            style="currency" currency="USD"/>{" "}
                into the account.
              </p>

              <div>
                <span className="text-xs italic">Create deployment</span>
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-success">Available</span>
                  <span>{minDeposit.usdc}$</span>
                  <iconoir_react_1.ArrowRight className="text-xs"/>
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
                  <iconoir_react_1.ArrowRight className="text-xs"/>
                  <span className="text-success">Available</span>
                </div>
              </div>
            </components_1.Alert>

            <components_1.Alert className="space-y-2">
              <h2 className="font-bold">About Providers</h2>
              <p className="text-sm text-muted-foreground">
                Each provider has a unique configuration when it comes to escrow accounts. Withdrawals from the escrow account to the provider can be any value
                starting at 5 minutes. The cost stays the same, but the escrow balance of your deployments will be reduced by the amount withdrawn based on the
                provider configuration.
              </p>
            </components_1.Alert>
          </div>
        </>)
        });
    };
    return {
        showManagedEscrowFaqModal: showManagedEscrowFaqModal
    };
};
exports.useManagedEscrowFaqModal = useManagedEscrowFaqModal;
