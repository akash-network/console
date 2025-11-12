"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLoginRequiredEventHandler = void 0;
var react_1 = require("react");
var context_1 = require("@akashnetwork/ui/context");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useUser_1 = require("@src/hooks/useUser");
var urlUtils_1 = require("@src/utils/urlUtils");
var useLoginRequiredEventHandler = function () {
    var requireAction = (0, context_1.usePopup)().requireAction;
    var user = (0, useUser_1.useUser)().user;
    var authService = (0, ServicesProvider_1.useServices)().authService;
    return (0, react_1.useCallback)(function (messageOtherwise) { return function (handler) {
        var preventer = function (event) {
            event.preventDefault();
            requireAction({
                message: messageOtherwise,
                actions: [
                    {
                        label: "Sign in",
                        side: "left",
                        size: "lg",
                        variant: "secondary",
                        onClick: function () {
                            window.location.href = urlUtils_1.UrlService.login();
                        }
                    },
                    {
                        label: "Sign up",
                        side: "right",
                        size: "lg",
                        onClick: function () {
                            authService.signup();
                        }
                    }
                ]
            });
        };
        return (user === null || user === void 0 ? void 0 : user.userId) ? handler : preventer;
    }; }, [user === null || user === void 0 ? void 0 : user.userId, requireAction]);
};
exports.useLoginRequiredEventHandler = useLoginRequiredEventHandler;
