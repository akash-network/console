"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAddFundsVerifiedLoginRequiredEventHandler = void 0;
var react_1 = require("react");
var flow_1 = require("lodash/flow");
var useEmailVerificationRequiredEventHandler_1 = require("@src/hooks/useEmailVerificationRequiredEventHandler");
var useLoginRequiredEventHandler_1 = require("@src/hooks/useLoginRequiredEventHandler");
var useAddFundsVerifiedLoginRequiredEventHandler = function () {
    var whenLoggedIn = (0, useLoginRequiredEventHandler_1.useLoginRequiredEventHandler)();
    var whenEmailIsVerified = (0, useEmailVerificationRequiredEventHandler_1.useEmailVerificationRequiredEventHandler)();
    return (0, react_1.useCallback)(function (handler) {
        return (0, flow_1.default)(whenEmailIsVerified("Verify your email to add funds to your balance."), whenLoggedIn("Sign In or Sign Up to add funds to your balance"))(handler);
    }, [whenEmailIsVerified, whenLoggedIn]);
};
exports.useAddFundsVerifiedLoginRequiredEventHandler = useAddFundsVerifiedLoginRequiredEventHandler;
