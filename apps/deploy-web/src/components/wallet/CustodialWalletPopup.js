"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustodialWalletPopup = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var link_1 = require("next/link");
var router_1 = require("next/router");
var browser_env_config_1 = require("@src/config/browser-env.config");
var denom_config_1 = require("@src/config/denom.config");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var walletStore_1 = require("@src/store/walletStore");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var urlUtils_1 = require("@src/utils/urlUtils");
var PriceValue_1 = require("../shared/PriceValue");
var ConnectManagedWalletButton_1 = require("./ConnectManagedWalletButton");
var withBilling = browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_BILLING_ENABLED;
var CustodialWalletPopup = function (_a) {
    var walletBalance = _a.walletBalance;
    var _b = (0, WalletProvider_1.useWallet)(), address = _b.address, logout = _b.logout;
    var router = (0, router_1.useRouter)();
    var isSignedInWithTrial = (0, jotai_1.useAtom)(walletStore_1.default.isSignedInWithTrial)[0];
    var user = (0, useCustomUser_1.useCustomUser)().user;
    var onAuthorizeSpendingClick = function () {
        router.push(urlUtils_1.UrlService.settingsAuthorizations());
    };
    return (<div className="w-[300px] p-2">
      <div className="mb-4">
        <components_1.Address address={address} isCopyable disableTooltip className="flex items-center justify-between text-sm font-bold text-foreground" showIcon/>
      </div>

      <div className="mb-1 text-xs text-muted-foreground">Wallet Balance</div>
      <div className="mb-4 rounded-md border border-success/10 bg-success/10 p-2 text-success dark:border-success/80 dark:bg-success/80 dark:text-foreground">
        {(walletBalance && (<>
            <div className="flex items-center justify-between space-x-2">
              <span className="text-xs">AKT</span>
              <span className="flex items-center space-x-1">
                <PriceValue_1.PriceValue denom={denom_config_1.UAKT_DENOM} value={(0, priceUtils_1.uaktToAKT)(walletBalance.totalUAKT, 2)}/>
                <span className="text-xs font-light">({(0, priceUtils_1.uaktToAKT)(walletBalance.totalUAKT, 2)} AKT)</span>
              </span>
            </div>

            <components_1.Separator className="my-2 bg-success/10 dark:bg-white/20"/>

            <div className="flex items-center justify-between space-x-2">
              <span className="text-xs">USDC</span>
              <span>
                <react_intl_1.FormattedNumber value={(0, mathHelpers_1.udenomToDenom)(walletBalance.totalUUSDC, 2)} style="currency" currency="USD"/>
              </span>
            </div>
          </>)) || <div className="space-x-2 text-xs text-white">Wallet Balance is unknown because the blockchain is unavailable</div>}
      </div>

      <div className="text-xs text-muted-foreground">Wallet Actions</div>

      <div className="flex flex-col items-center justify-end space-y-2 pt-2">
        <components_1.Button onClick={function () { return onAuthorizeSpendingClick(); }} variant="outline" className="w-full space-x-2">
          <iconoir_react_1.Bank />
          <span>Authorize Spending</span>
        </components_1.Button>
        <components_1.Button onClick={logout} variant="outline" className="w-full space-x-2">
          <iconoir_react_1.LogOut />
          <span>Disconnect Wallet</span>
        </components_1.Button>
        {withBilling && (<>
            <components_1.Separator className="my-4"/>

            {isSignedInWithTrial && !user ? (<link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "outline" }), "w-full space-x-2")} href={urlUtils_1.UrlService.login()}>
                Sign in for USD Payments
              </link_1.default>) : (<ConnectManagedWalletButton_1.ConnectManagedWalletButton className="w-full"/>)}
          </>)}
      </div>
    </div>);
};
exports.CustodialWalletPopup = CustodialWalletPopup;
