"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifiedPayingCustomerRequiredLink = void 0;
var react_1 = require("react");
var useVerifiedPayingCustomerLoginRequiredEventHandler_1 = require("@src/hooks/useVerifiedPayingCustomerLoginRequiredEventHandler");
var VerifiedPayingCustomerRequiredLink = function (_a) {
    var children = _a.children, disabled = _a.disabled, onClick = _a.onClick, className = _a.className, rest = __rest(_a, ["children", "disabled", "onClick", "className"]);
    var whenLoggedCustomerInAndVerified = (0, useVerifiedPayingCustomerLoginRequiredEventHandler_1.useVerifiedPayingCustomerLoginRequiredEventHandler)();
    return react_1.default.cloneElement(children, __assign({ className: className, disabled: disabled, onClick: disabled ? undefined : whenLoggedCustomerInAndVerified(onClick || (function () { })) }, rest));
};
exports.VerifiedPayingCustomerRequiredLink = VerifiedPayingCustomerRequiredLink;
