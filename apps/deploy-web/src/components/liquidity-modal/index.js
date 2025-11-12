"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var react_2 = require("@cosmos-kit/react");
// import * as Elements from "@leapwallet/elements-umd-types";
var material_1 = require("@mui/material");
var WalletProvider_1 = require("@src/context/WalletProvider");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var ToggleLiquidityModalButton = function (_a) {
    var onClick = _a.onClick;
    var _onClick = function () {
        analytics_service_1.analyticsService.track("leap_get_more_tokens", {
            category: "wallet",
            label: "Open Leap liquidity modal"
        });
        onClick();
    };
    return (<components_1.Button variant="default" size="xs" onClick={_onClick}>
      Get More
    </components_1.Button>);
};
// TODO: Fix the elements types
// const convertWalletType = (walletName: string | undefined): Elements.WalletType | undefined => {
var convertWalletType = function (walletName) {
    if (!window.LeapElements) {
        return undefined;
    }
    var walletType = window.LeapElements.WalletType;
    switch (walletName) {
        case "leap-extension":
            return walletType.LEAP;
        case "keplr-extension":
            return walletType.KEPLR;
        case "cosmostation-extension":
            return walletType.COSMOSTATION;
        case "keplr-mobile":
            return walletType.WC_KEPLR_MOBILE;
        default:
            return undefined;
    }
};
// const getTabsConfig = (txnLifecycleHooks: Partial<Elements.TxnLifecycleHooks<unknown>>) => {
var getTabsConfig = function (txnLifecycleHooks) {
    return {
        aggregated: {
            enabled: true,
            orderIndex: 0,
            title: "Swap or Bridge",
            allowedDestinationChains: [
                {
                    chainId: "akashnet-2"
                }
            ],
            defaultValues: {
                sourceChainId: "osmosis-1",
                sourceAsset: "uosmo",
                destinationChainId: "akashnet-2",
                destinationAsset: "uakt"
            },
            txnLifecycleHooks: txnLifecycleHooks
        },
        swap: {
            enabled: false
        },
        "fiat-on-ramp": {
            enabled: true,
            title: "Buy AKT",
            orderIndex: 1,
            allowedDestinationChains: [
                {
                    chainId: "akashnet-2"
                }
            ],
            defaultValues: {
                currency: "USD",
                sourceAmount: "10",
                destinationChainId: "akashnet-2",
                destinationAsset: "uakt"
            },
            onTxnComplete: txnLifecycleHooks.onTxnComplete
        },
        transfer: {
            enabled: true,
            orderIndex: 2,
            title: "IBC Transfer",
            defaultValues: {
                sourceChainId: "osmosis-1",
                sourceAsset: { originChainId: "akashnet-2", originDenom: "uakt" }
            },
            txnLifecycleHooks: txnLifecycleHooks
        }
    };
    // } satisfies Elements.TabsConfig;
};
var LiquidityModal = function (_a) {
    var refreshBalances = _a.refreshBalances;
    var _b = (0, react_1.useState)(false), isOpen = _b[0], setIsOpen = _b[1];
    var _c = (0, react_1.useState)(false), isElementsReady = _c[0], setIsElementsReady = _c[1];
    var isElementsMounted = (0, react_1.useRef)(false);
    var isWalletConnected = (0, WalletProvider_1.useWallet)().isWalletConnected;
    var walletClient = (0, react_2.useWalletClient)().client;
    var mainWallet = (0, react_2.useWallet)().mainWallet;
    var walletName = isWalletConnected ? mainWallet === null || mainWallet === void 0 ? void 0 : mainWallet.walletName : undefined;
    var handleConnectWallet = (0, react_1.useCallback)(function () {
        if (!isWalletConnected && walletClient) {
            if (walletClient.enable) {
                return walletClient.enable("akashnet-2");
            }
            else if (walletClient.connect) {
                return walletClient.connect("akashnet-2");
            }
        }
        else {
            throw new Error("Wallet is not connected");
        }
    }, [isWalletConnected, walletClient]);
    var tabsConfig = (0, react_1.useMemo)(function () {
        // const txnLifecycleHooks: Partial<Elements.TxnLifecycleHooks<never>> = {
        var txnLifecycleHooks = {
            onTxnComplete: function () {
                refreshBalances();
                analytics_service_1.analyticsService.track("leap_tx_complete", {
                    category: "wallet",
                    label: "Completed a transaction on Leap liquidity modal"
                });
            }
        };
        return getTabsConfig(txnLifecycleHooks);
    }, [refreshBalances]);
    var connectedWalletType = (0, react_1.useMemo)(function () { return (isElementsReady ? convertWalletType(walletName) : undefined); }, [isElementsReady, walletName]);
    (0, react_1.useEffect)(function () {
        var _a, _b;
        if (isElementsReady && isOpen && !isElementsMounted.current) {
            isElementsMounted.current = true;
            (_b = (_a = window.LeapElements) === null || _a === void 0 ? void 0 : _a.mountElements) === null || _b === void 0 ? void 0 : _b.call(_a, {
                connectWallet: handleConnectWallet,
                connectedWalletType: connectedWalletType,
                element: {
                    name: "multi-view",
                    props: {
                        tabsConfig: tabsConfig
                    }
                },
                enableSmartSwap: true,
                skipClientId: "akashnet-console-".concat(process.env.NODE_ENV),
                enableCaching: true,
                elementsRoot: "#leap-elements-portal"
            });
        }
    }, [isOpen, handleConnectWallet, connectedWalletType, tabsConfig, isElementsReady]);
    (0, react_1.useEffect)(function () {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        }
        else {
            document.body.style.overflow = "auto";
        }
    }, [isOpen]);
    (0, react_1.useEffect)(function () {
        isElementsMounted.current = false;
    }, [connectedWalletType]);
    (0, react_1.useEffect)(function () {
        if (!window) {
            return;
        }
        if (window.LeapElements) {
            setIsElementsReady(true);
            return;
        }
        var cb = function () {
            setIsElementsReady(true);
        };
        window.addEventListener("@leapwallet/elements:load", cb);
        return function () {
            window.removeEventListener("@leapwallet/elements:load", cb);
        };
    }, []);
    return (<>
      <ToggleLiquidityModalButton onClick={function () { return setIsOpen(function (o) { return !o; }); }}/>
      {walletClient ? (<material_1.Modal keepMounted open={isOpen} onClose={function () { return setIsOpen(false); }} className="flex items-center justify-center">
          <div className="relative h-full max-h-[34rem] w-full max-w-[26rem]">
            {!isElementsReady ? <components_1.Spinner className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2"/> : null}
            <div id="leap-elements-portal" className="leap-ui dark h-full w-full rounded-xl"/>
          </div>
        </material_1.Modal>) : null}
    </>);
};
LiquidityModal.displayName = "LiquidityModal";
exports.default = LiquidityModal;
