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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCustomUser = void 0;
var client_1 = require("@auth0/nextjs-auth0/client");
var plans_1 = require("@src/utils/plans");
/**
 * Returns information about registered user.
 */
var useCustomUser = function () {
    var _a = (0, client_1.useUser)(), user = _a.user, isLoading = _a.isLoading, error = _a.error, checkSession = _a.checkSession;
    var completeUser = user ? __assign(__assign({}, user), { plan: plans_1.plans.find(function (x) { return x.code === user.planCode; }) }) : user;
    return {
        user: completeUser,
        isLoading: isLoading,
        error: error,
        checkSession: checkSession
    };
};
exports.useCustomUser = useCustomUser;
