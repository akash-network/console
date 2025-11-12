"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrerequisiteList = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var ChainParamProvider_1 = require("@src/context/ChainParamProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var ConnectWallet_1 = require("./ConnectWallet");
var Title_1 = require("./Title");
var PrerequisiteList = function (_a) {
    var onClose = _a.onClose, onContinue = _a.onContinue;
    var _b = (0, react_1.useState)(false), isLoadingPrerequisites = _b[0], setIsLoadingPrerequisites = _b[1];
    var _c = (0, react_1.useState)(null), isBalanceValidated = _c[0], setIsBalanceValidated = _c[1];
    var _d = (0, WalletProvider_1.useWallet)(), address = _d.address, isManaged = _d.isManaged;
    var walletBalance = (0, useWalletBalance_1.useWalletBalance)().balance;
    var minDeposit = (0, ChainParamProvider_1.useChainParam)().minDeposit;
    (0, react_1.useEffect)(function () {
        if (isManaged) {
            onContinue();
        }
        if (address && (minDeposit.akt || minDeposit.usdc) && !!walletBalance) {
            setIsLoadingPrerequisites(true);
            var isBalanceValidated_1 = walletBalance.balanceUAKT >= (0, priceUtils_1.aktToUakt)(minDeposit.akt) || walletBalance.balanceUUSDC >= (0, mathHelpers_1.denomToUdenom)(minDeposit.usdc);
            setIsBalanceValidated(isBalanceValidated_1);
            setIsLoadingPrerequisites(false);
            if (isBalanceValidated_1) {
                onContinue();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, walletBalance === null || walletBalance === void 0 ? void 0 : walletBalance.balanceUAKT, walletBalance === null || walletBalance === void 0 ? void 0 : walletBalance.balanceUUSDC, minDeposit.akt, minDeposit.usdc, isManaged]);
    return (<components_1.Popup fullWidth open variant="custom" actions={[
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
                disabled: isLoadingPrerequisites || !address,
                isLoading: isLoadingPrerequisites,
                onClick: onContinue
            }
        ]} hideCloseButton maxWidth="sm" enableCloseOnBackdropClick={false} title="Checking Prerequisites">
      {address ? (<components_1.Card>
          <components_1.CardContent className="p-4">
            <ul className="space-y-4 pb-4 pt-0">
              <li className="flex items-center space-x-4">
                <components_1.Avatar className="h-10 w-10">
                  <components_1.AvatarFallback>
                    {isBalanceValidated === null && <components_1.Spinner size="small"/>}
                    {isBalanceValidated === true && <iconoir_react_1.CheckCircle className="text-green-600"/>}
                    {isBalanceValidated === false && <iconoir_react_1.WarningCircle className="text-destructive"/>}
                  </components_1.AvatarFallback>
                </components_1.Avatar>

                <div className="flex flex-col">
                  <Title_1.Title subTitle className="!text-lg">
                    Wallet Balance
                  </Title_1.Title>
                  <p className="text-sm text-muted-foreground">
                    The balance of the wallet needs to be of at least {minDeposit.akt} AKT or {minDeposit.usdc} USDC to create a deployment.
                  </p>
                </div>
              </li>
            </ul>
          </components_1.CardContent>
        </components_1.Card>) : (<div className="py-8">
          <ConnectWallet_1.ConnectWallet text="Setup your billing to deploy!"/>
        </div>)}
    </components_1.Popup>);
};
exports.PrerequisiteList = PrerequisiteList;
