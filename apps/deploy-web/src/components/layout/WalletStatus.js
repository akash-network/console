"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletStatus = WalletStatus;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var ClickAwayListener_1 = require("@mui/material/ClickAwayListener");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var ConnectManagedWalletButton_1 = require("@src/components/wallet/ConnectManagedWalletButton");
var browser_env_config_1 = require("@src/config/browser-env.config");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useShortText_1 = require("@src/hooks/useShortText");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var walletStore_1 = require("@src/store/walletStore");
var ConnectWalletButton_1 = require("../wallet/ConnectWalletButton");
var CustodialWalletPopup_1 = require("../wallet/CustodialWalletPopup");
var ManagedWalletPopup_1 = require("../wallet/ManagedWalletPopup");
var withBilling = browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED;
function WalletStatus() {
    var _a = (0, WalletProvider_1.useWallet)(), walletName = _a.walletName, isWalletLoaded = _a.isWalletLoaded, isWalletConnected = _a.isWalletConnected, isManaged = _a.isManaged, isWalletLoading = _a.isWalletLoading, isTrialing = _a.isTrialing;
    var _b = (0, useWalletBalance_1.useWalletBalance)(), walletBalance = _b.balance, isWalletBalanceLoading = _b.isLoading;
    var isSignedInWithTrial = (0, jotai_1.useAtom)(walletStore_1.default.isSignedInWithTrial)[0];
    var _c = (0, react_1.useState)(false), open = _c[0], setOpen = _c[1];
    var isLoadingBalance = isWalletBalanceLoading && !walletBalance;
    var isInit = isWalletLoaded && !isWalletLoading && !isLoadingBalance;
    return (<>
      {isInit ? (isWalletConnected ? (<div className="flex w-full items-center">
            <div className="w-full py-2">
              <components_1.DropdownMenu modal={false} open={open}>
                <components_1.DropdownMenuTrigger asChild>
                  <div className={(0, utils_1.cn)("flex items-center justify-center rounded-md border px-4 py-2 text-sm", {
                "border-primary bg-primary/10 text-primary dark:bg-primary dark:text-primary-foreground": isManaged,
                "bg-background text-foreground": !isManaged
            })} onMouseOver={function () { return setOpen(true); }}>
                    <div className="flex items-center space-x-2" aria-label="Connected wallet name and balance">
                      {isManaged && isTrialing && <span className="text-xs">Trial</span>}
                      {!isManaged && (<>
                          <iconoir_react_1.Wallet className="text-xs"/>
                          {(walletName === null || walletName === void 0 ? void 0 : walletName.length) > 20 ? (<span className="text-xs">{(0, useShortText_1.getSplitText)(walletName, 4, 4)}</span>) : (<span className="text-xs">{walletName}</span>)}
                        </>)}
                    </div>

                    {walletBalance && ((isManaged && isTrialing) || !isManaged) && <div className="px-2">|</div>}

                    <div className="text-xs">
                      {walletBalance && (<react_intl_1.FormattedNumber value={isManaged ? walletBalance.totalDeploymentGrantsUSD : walletBalance.totalUsd} 
            // eslint-disable-next-line react/style-prop-object
            style="currency" currency="USD"/>)}
                    </div>

                    <div>
                      <iconoir_react_1.NavArrowDown className="ml-2 text-xs"/>
                    </div>
                  </div>
                </components_1.DropdownMenuTrigger>
                <components_1.DropdownMenuContent align="end" onMouseLeave={function () {
                setOpen(false);
            }}>
                  <ClickAwayListener_1.default onClickAway={function () {
                setOpen(false);
            }}>
                    <div>
                      {!isManaged && <CustodialWalletPopup_1.CustodialWalletPopup walletBalance={walletBalance}/>}
                      {withBilling && isManaged && <ManagedWalletPopup_1.ManagedWalletPopup walletBalance={walletBalance}/>}
                    </div>
                  </ClickAwayListener_1.default>
                </components_1.DropdownMenuContent>
              </components_1.DropdownMenu>
            </div>
          </div>) : (<div className="w-full">
            {withBilling && !isSignedInWithTrial && <ConnectManagedWalletButton_1.ConnectManagedWalletButton className="mb-2 mr-2 w-full md:mb-0 md:w-auto"/>}
            <ConnectWalletButton_1.ConnectWalletButton className="w-full md:w-auto"/>
          </div>)) : (<div className="flex items-center justify-center p-4">
          <components_1.Spinner size="medium"/>
        </div>)}
    </>);
}
