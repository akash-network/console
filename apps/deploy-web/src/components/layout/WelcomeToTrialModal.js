"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomeToTrialModal = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useFlag_1 = require("@src/hooks/useFlag");
var useLocalStorage_1 = require("@src/hooks/useLocalStorage");
var useManagedWallet_1 = require("@src/hooks/useManagedWallet");
var networkStore_1 = require("@src/store/networkStore");
var WelcomeToTrialModal = function () {
    var managedWallet = (0, useManagedWallet_1.useManagedWallet)().wallet;
    var address = (0, WalletProvider_1.useWallet)().address;
    var allowAnonymousUserTrial = (0, useFlag_1.useFlag)("anonymous_free_trial");
    var selectedNetworkId = networkStore_1.default.useSelectedNetworkId();
    var localStorageKey = "welcomeModalSeen";
    var localStorageValue = "true";
    var _a = (0, useLocalStorage_1.useLocalStorage)(), getLocalStorageItem = _a.getLocalStorageItem, setLocalStorageItem = _a.setLocalStorageItem;
    var _b = (0, react_1.useState)(false), shouldModalShow = _b[0], setShouldModalShow = _b[1];
    (0, react_1.useEffect)(function () {
        if (address && selectedNetworkId) {
            setShouldModalShow(getLocalStorageItem(localStorageKey) !== localStorageValue);
        }
    }, [address, getLocalStorageItem, selectedNetworkId]);
    var writeLocalStorage = (0, react_1.useCallback)(function () {
        setLocalStorageItem(localStorageKey, localStorageValue);
        setShouldModalShow(false);
    }, [setLocalStorageItem]);
    var isWelcomeModalOpen = (0, react_1.useMemo)(function () {
        return (managedWallet === null || managedWallet === void 0 ? void 0 : managedWallet.isTrialing) === true && shouldModalShow && allowAnonymousUserTrial;
    }, [managedWallet === null || managedWallet === void 0 ? void 0 : managedWallet.isTrialing, shouldModalShow, allowAnonymousUserTrial]);
    return (<>
      {isWelcomeModalOpen && (<components_1.Popup fullWidth open={isWelcomeModalOpen} variant="custom" actions={[
                {
                    label: "Close",
                    color: "primary",
                    variant: "text",
                    side: "right",
                    onClick: writeLocalStorage
                }
            ]} onClose={writeLocalStorage} maxWidth="sm" enableCloseOnBackdropClick title="Welcome to Your Free Trial!">
          <>
            <p className="mb-4">
              You&apos;re all set to start deploying your first service. During your trial, you can create and manage up to 5 deployments — perfect for
              exploring everything our platform has to offer.
            </p>
            <p>Get started now and see what you can build!</p>
          </>
        </components_1.Popup>)}
    </>);
};
exports.WelcomeToTrialModal = WelcomeToTrialModal;
