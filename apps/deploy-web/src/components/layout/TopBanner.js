"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopBanner = TopBanner;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var WalletProvider_1 = require("@src/context/WalletProvider/WalletProvider");
var useTopBanner_1 = require("@src/hooks/useTopBanner");
var ConnectManagedWalletButton_1 = require("../wallet/ConnectManagedWalletButton");
function CreditCardBanner() {
    var hasManagedWallet = (0, WalletProvider_1.useWallet)().hasManagedWallet;
    return (<div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 md:space-x-4">
      <span className="text-xs font-semibold text-white md:text-sm">Credit Card payments are now available!</span>

      {!hasManagedWallet && <ConnectManagedWalletButton_1.ConnectManagedWalletButton className="flex-shrink-0 text-white hover:text-white" size="sm" variant="text"/>}
    </div>);
}
function NetworkDownBanner() {
    var date = (0, useTopBanner_1.useChainMaintenanceDetails)().date;
    var _a = (0, react_1.useState)(false), isUpgrading = _a[0], setIsUpgrading = _a[1];
    (0, react_1.useEffect)(function () {
        if (!date)
            return;
        var timerId;
        function checkIsUpgrading() {
            var isUpgrading = Date.now() >= new Date(date).getTime();
            setIsUpgrading(isUpgrading);
            if (!isUpgrading) {
                timerId = setTimeout(checkIsUpgrading, 60000);
            }
        }
        checkIsUpgrading();
        return function () {
            if (timerId)
                clearTimeout(timerId);
        };
    }, [date]);
    return (<div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 md:space-x-4">
      <span className="text-xs font-semibold text-white md:text-sm">
        {isUpgrading
            ? "We are upgrading the blockchain. Console operations are temporarily restricted to read-only."
            : "Blockchain unavailable — console in read-only mode until service is restored."}
      </span>
    </div>);
}
function MaintenanceBanner(_a) {
    var onClose = _a.onClose;
    var date = (0, useTopBanner_1.useChainMaintenanceDetails)().date;
    var intl = (0, react_intl_1.useIntl)();
    var upgradeAt = (0, react_1.useMemo)(function () { return (date ? intl.formatDate(date, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""); }, [date, intl]);
    return (<div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 md:space-x-4">
      <span className="text-xs font-semibold text-white md:text-sm">
        Network upgrade scheduled{upgradeAt ? " at ".concat(upgradeAt) : ""}. Console will switch to read-only mode during the upgrade.
      </span>
      <components_1.Button variant="text" className="rounded-full text-white hover:text-white" size="icon" onClick={onClose}>
        <iconoir_react_1.Xmark />
      </components_1.Button>
    </div>);
}
function TopBanner() {
    var _a = (0, useTopBanner_1.useTopBanner)(), isMaintananceBannerOpen = _a.isMaintenanceBannerOpen, setIsMaintananceBannerOpen = _a.setIsMaintenanceBannerOpen, isBlockchainDown = _a.isBlockchainDown, hasCreditCardBanner = _a.hasCreditCardBanner;
    if (isBlockchainDown) {
        return <NetworkDownBanner />;
    }
    if (isMaintananceBannerOpen) {
        return <MaintenanceBanner onClose={function () { return setIsMaintananceBannerOpen(false); }}/>;
    }
    if (hasCreditCardBanner) {
        return <CreditCardBanner />;
    }
    return null;
}
