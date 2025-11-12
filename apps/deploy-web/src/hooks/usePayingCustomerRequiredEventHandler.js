"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePayingCustomerRequiredEventHandler = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var context_1 = require("@akashnetwork/ui/context");
var navigation_1 = require("next/navigation");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useUser_1 = require("@src/hooks/useUser");
var urlUtils_1 = require("@src/utils/urlUtils");
var usePayingCustomerRequiredEventHandler = function () {
    var requireAction = (0, context_1.usePopup)().requireAction;
    var user = (0, useUser_1.useUser)().user;
    var _a = (0, WalletProvider_1.useWallet)(), isTrialing = _a.isTrialing, isManaged = _a.isManaged;
    var router = (0, navigation_1.useRouter)();
    return (0, react_1.useCallback)(function (messageOtherwise) { return function (handler) {
        var preventer = function (event) {
            event.preventDefault();
            requireAction({
                message: (<components_1.Alert className="my-2" variant="warning">
              {messageOtherwise}
            </components_1.Alert>),
                actions: function (_a) {
                    var close = _a.close;
                    return [
                        {
                            label: "Add Funds",
                            side: "right",
                            size: "lg",
                            onClick: function () {
                                router.push(urlUtils_1.UrlService.payment());
                                close();
                            }
                        }
                    ];
                }
            });
        };
        return (user === null || user === void 0 ? void 0 : user.userId) && isManaged && !isTrialing ? handler : preventer;
    }; }, [isTrialing, isManaged, requireAction, user === null || user === void 0 ? void 0 : user.userId]);
};
exports.usePayingCustomerRequiredEventHandler = usePayingCustomerRequiredEventHandler;
