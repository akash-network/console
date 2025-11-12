"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentMinimumEscrowAlertText = void 0;
var react_1 = require("react");
var ChainParamProvider_1 = require("@src/context/ChainParamProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var DeploymentMinimumEscrowAlertText = function () {
    var isManaged = (0, WalletProvider_1.useWallet)().isManaged;
    var sdlDenom = (0, react_1.useState)("uakt")[0];
    var depositData = (0, useWalletBalance_1.useDenomData)(sdlDenom);
    var minDeposit = (0, ChainParamProvider_1.useChainParam)().minDeposit;
    return isManaged ? (<>
      To create a deployment, you need to have at least <b>${depositData === null || depositData === void 0 ? void 0 : depositData.min}</b> in an escrow account.{" "}
    </>) : (<>
      To create a deployment, you need to have at least <b>{minDeposit.akt} AKT</b> or <b>{minDeposit.usdc} USDC</b> in an escrow account.{" "}
    </>);
};
exports.DeploymentMinimumEscrowAlertText = DeploymentMinimumEscrowAlertText;
