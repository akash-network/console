"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useVerifiedPayingCustomerLoginRequiredEventHandler = void 0;
var react_1 = require("react");
var flow_1 = require("lodash/flow");
var useEmailVerificationRequiredEventHandler_1 = require("@src/hooks/useEmailVerificationRequiredEventHandler");
var useLoginRequiredEventHandler_1 = require("@src/hooks/useLoginRequiredEventHandler");
var usePayingCustomerRequiredEventHandler_1 = require("@src/hooks/usePayingCustomerRequiredEventHandler");
var useVerifiedPayingCustomerLoginRequiredEventHandler = function () {
    var whenLoggedIn = (0, useLoginRequiredEventHandler_1.useLoginRequiredEventHandler)();
    var whenEmailIsVerified = (0, useEmailVerificationRequiredEventHandler_1.useEmailVerificationRequiredEventHandler)();
    var whenPayingCustomer = (0, usePayingCustomerRequiredEventHandler_1.usePayingCustomerRequiredEventHandler)();
    return (0, react_1.useCallback)(function (handler) {
        return (0, flow_1.default)(whenEmailIsVerified("Verify your email and add funds to add access this feature."), whenLoggedIn("Sign In or Sign Up to add access this feature."), whenPayingCustomer("Add funds to your balance to add access this feature."))(handler);
    }, [whenEmailIsVerified, whenLoggedIn, whenPayingCustomer]);
};
exports.useVerifiedPayingCustomerLoginRequiredEventHandler = useVerifiedPayingCustomerLoginRequiredEventHandler;
