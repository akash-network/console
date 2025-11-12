"use strict";
"use client";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomChainProvider = CustomChainProvider;
exports.useSelectedChain = useSelectedChain;
require("@interchain-ui/react/styles");
require("@interchain-ui/react/globalStyles");
var react_1 = require("react");
var stargate_1 = require("@cosmjs/stargate");
var cosmos_extension_metamask_1 = require("@cosmos-kit/cosmos-extension-metamask");
var cosmostation_extension_1 = require("@cosmos-kit/cosmostation-extension");
var keplr_1 = require("@cosmos-kit/keplr");
var leap_1 = require("@cosmos-kit/leap");
var react_2 = require("@cosmos-kit/react");
var jotai_1 = require("jotai");
var chains_1 = require("@src/chains");
var networkStore_1 = require("@src/store/networkStore");
var walletStore_1 = require("@src/store/walletStore");
var customRegistry_1 = require("@src/utils/customRegistry");
function CustomChainProvider(_a) {
    var children = _a.children;
    return (<react_2.ChainProvider chains={[chains_1.akash, chains_1.akashSandbox, chains_1.akashTestnet]} assetLists={chains_1.assetLists} wallets={__spreadArray(__spreadArray(__spreadArray(__spreadArray([], keplr_1.wallets, true), leap_1.wallets, true), cosmostation_extension_1.wallets, true), cosmos_extension_metamask_1.wallets, true)} walletModal={ModalWrapper} sessionOptions={{
            duration: 31556926000, // 1 year
            callback: function () {
                console.log("session expired");
                window.localStorage.removeItem("cosmos-kit@2:core//current-wallet");
                window.location.reload();
            }
        }} walletConnectOptions={{
            signClient: {
                projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
            }
        }} endpointOptions={{
            isLazy: true,
            endpoints: {
                akash: { rest: [], rpc: [] },
                "akash-sandbox": { rest: [], rpc: [] },
                "akash-testnet": { rest: [], rpc: [] }
            }
        }} signerOptions={{
            preferredSignType: function () { return "direct"; },
            signingStargate: function () {
                return ({
                    registry: customRegistry_1.registry,
                    gasPrice: stargate_1.GasPrice.fromString("0.025uakt")
                });
            }
        }}>
      {children}
    </react_2.ChainProvider>);
}
function useSelectedChain() {
    var chainRegistryName = networkStore_1.default.useSelectedNetwork().chainRegistryName;
    return (0, react_2.useChain)(chainRegistryName);
}
var ModalWrapper = function (props) {
    var isWalletConnected = useSelectedChain().isWalletConnected;
    var _a = (0, jotai_1.useAtom)(walletStore_1.default.isWalletModalOpen), isWalletModalOpen = _a[0], setIsWalletModalOpen = _a[1];
    var _b = (0, jotai_1.useAtom)(walletStore_1.default.selectedWalletType), setSelectedWalletType = _b[1];
    (0, react_1.useEffect)(function () {
        setIsWalletModalOpen(props.isOpen);
        if (isWalletModalOpen && !props.isOpen && isWalletConnected) {
            setSelectedWalletType("custodial");
        }
    }, [isWalletModalOpen, props.isOpen, isWalletConnected]);
    return <react_2.DefaultModal {...props} isOpen={props.isOpen} setOpen={props.setOpen}/>;
};
