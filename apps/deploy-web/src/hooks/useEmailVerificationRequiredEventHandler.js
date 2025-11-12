"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useEmailVerificationRequiredEventHandler = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var context_1 = require("@akashnetwork/ui/context");
var notistack_1 = require("notistack");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var useEmailVerificationRequiredEventHandler = function () {
    var requireAction = (0, context_1.usePopup)().requireAction;
    var user = (0, useCustomUser_1.useCustomUser)().user;
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var _a = (0, ServicesProvider_1.useServices)(), auth = _a.auth, analyticsService = _a.analyticsService;
    return (0, react_1.useCallback)(function (messageOtherwise) { return function (handler) {
        var preventer = function (event) {
            event.preventDefault();
            requireAction({
                message: messageOtherwise,
                actions: function (_a) {
                    var close = _a.close;
                    return [
                        {
                            label: "Resend verification email",
                            side: "left",
                            size: "lg",
                            onClick: function () {
                                analyticsService.track("resend_verification_email_btn_clk", "Amplitude");
                                if (!(user === null || user === void 0 ? void 0 : user.id)) {
                                    return;
                                }
                                auth
                                    .sendVerificationEmail(user.id)
                                    .then(function () {
                                    enqueueSnackbar(<components_1.Snackbar title="Email requested" subTitle="Please check your email and click a verification link" iconVariant="success"/>, {
                                        variant: "success"
                                    });
                                })
                                    .catch(function () {
                                    enqueueSnackbar(<components_1.Snackbar title="Failed to request email" subTitle="Please try again later or contact support" iconVariant="error"/>, {
                                        variant: "error"
                                    });
                                })
                                    .finally(close);
                            }
                        }
                    ];
                }
            });
        };
        return (user === null || user === void 0 ? void 0 : user.emailVerified) ? handler : preventer;
    }; }, [user === null || user === void 0 ? void 0 : user.emailVerified, user === null || user === void 0 ? void 0 : user.id, requireAction, enqueueSnackbar]);
};
exports.useEmailVerificationRequiredEventHandler = useEmailVerificationRequiredEventHandler;
