"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagedWalletPopup = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var CustomChainProvider_1 = require("@src/context/CustomChainProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useManagedEscrowFaqModal_1 = require("@src/hooks/useManagedEscrowFaqModal");
var urlUtils_1 = require("@src/utils/urlUtils");
var LinkTo_1 = require("../shared/LinkTo");
var AddFundsLink_1 = require("../user/AddFundsLink");
var ManagedWalletPopup = function (_a) {
    var walletBalance = _a.walletBalance;
    var _b = (0, WalletProvider_1.useWallet)(), isManaged = _b.isManaged, isTrialing = _b.isTrialing, switchWalletType = _b.switchWalletType;
    var showManagedEscrowFaqModal = (0, useManagedEscrowFaqModal_1.useManagedEscrowFaqModal)().showManagedEscrowFaqModal;
    var _c = (0, CustomChainProvider_1.useSelectedChain)(), connect = _c.connect, isWalletConnected = _c.isWalletConnected;
    return (<div className="w-[300px] p-2">
      {isManaged && isTrialing && (<div className="mb-2 text-sm font-bold">
          <p className="text-center">Free Trial</p>
        </div>)}
      <div className="rounded-md border border-primary/50 bg-primary/10 p-2 text-primary dark:bg-primary dark:text-foreground">
        {(walletBalance && (<>
            <div className="flex items-center justify-between space-x-2">
              <span className="text-xs">Credits Remaining:</span>
              <span>
                <react_intl_1.FormattedNumber value={walletBalance.totalDeploymentGrantsUSD - walletBalance.totalDeploymentEscrowUSD} 
        // eslint-disable-next-line react/style-prop-object
        style="currency" currency="USD"/>
              </span>
            </div>

            <components_1.Separator className="my-2 bg-primary/50 dark:bg-white/20"/>

            <div className="flex items-center justify-between space-x-2">
              <span className="text-xs">Deposits:</span>
              <span>
                <react_intl_1.FormattedNumber value={walletBalance.totalDeploymentEscrowUSD} 
        // eslint-disable-next-line react/style-prop-object
        style="currency" currency="USD"/>
              </span>
            </div>
          </>)) || <div className="space-x-2 text-xs text-white">Wallet Balance is unknown because the blockchain is unavailable</div>}
      </div>
      <div className="mb-2 mt-1 flex items-center justify-end">
        <LinkTo_1.LinkTo className="text-xs text-foreground no-underline" onClick={function () { return showManagedEscrowFaqModal(); }}>
          What's this?
        </LinkTo_1.LinkTo>
      </div>

      {isManaged && isTrialing && (<div className="my-2 text-center text-xs text-muted-foreground">
          Once your Free credits run out, deployments will automatically close. To continue, create an account and add funds with your credit card. Deployments
          from your Free Trial get transferred when creating a new account.
        </div>)}

      <div className="flex flex-col items-center justify-end space-y-2 pt-2">
        <AddFundsLink_1.AddFundsLink className={(0, utils_1.cn)("w-full hover:no-underline", (0, components_1.buttonVariants)({ variant: "default" }))} href={urlUtils_1.UrlService.payment()}>
          <span className="whitespace-nowrap">Add Funds</span>
          <iconoir_react_1.HandCard className="ml-2 text-xs"/>
        </AddFundsLink_1.AddFundsLink>
        <components_1.Separator className="my-2 bg-secondary/90 dark:bg-white/10"/>
        <components_1.Button onClick={isWalletConnected ? switchWalletType : connect} variant="outline" className="w-full space-x-2">
          <iconoir_react_1.CoinsSwap />
          <span>Switch to Wallet Payments</span>
        </components_1.Button>
      </div>
    </div>);
};
exports.ManagedWalletPopup = ManagedWalletPopup;
