"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStoredAnonymousUser = void 0;
var react_1 = require("react");
var auth_config_1 = require("@src/config/auth.config");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var useWhen_1 = require("@src/hooks/useWhen");
var useAnonymousUserQuery_1 = require("@src/queries/useAnonymousUserQuery/useAnonymousUserQuery");
var storedAnonymousUserStr = typeof window !== "undefined" && localStorage.getItem(auth_config_1.ANONYMOUS_USER_KEY);
var storedAnonymousUser = storedAnonymousUserStr ? JSON.parse(storedAnonymousUserStr) : undefined;
var useStoredAnonymousUser = function () {
    var appConfig = (0, ServicesProvider_1.useServices)().appConfig;
    var _a = (0, useCustomUser_1.useCustomUser)(), registeredUser = _a.user, isLoadingRegisteredUser = _a.isLoading;
    var _b = (0, useAnonymousUserQuery_1.useAnonymousUserQuery)(storedAnonymousUser === null || storedAnonymousUser === void 0 ? void 0 : storedAnonymousUser.id, {
        enabled: appConfig.NEXT_PUBLIC_BILLING_ENABLED && !registeredUser && !isLoadingRegisteredUser
    }), user = _b.user, isLoading = _b.isLoading, token = _b.token, error = _b.error;
    (0, useWhen_1.useWhen)(storedAnonymousUser && !storedAnonymousUser.userId && error && "status" in error && error.status === 401, function () {
        localStorage.removeItem(auth_config_1.ANONYMOUS_USER_KEY);
        localStorage.removeItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY);
        window.location.reload();
    });
    (0, useWhen_1.useWhen)(user, function () { return localStorage.setItem("anonymous-user", JSON.stringify(user)); });
    (0, useWhen_1.useWhen)(registeredUser === null || registeredUser === void 0 ? void 0 : registeredUser.id, function () {
        localStorage.removeItem(auth_config_1.ANONYMOUS_USER_KEY);
        localStorage.removeItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY);
    });
    (0, useWhen_1.useWhen)(token, function () {
        if (token) {
            localStorage.setItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY, token);
        }
    });
    return (0, react_1.useMemo)(function () { return ({
        user: user,
        isLoading: isLoadingRegisteredUser || isLoading
    }); }, [user, isLoadingRegisteredUser, isLoading]);
};
exports.useStoredAnonymousUser = useStoredAnonymousUser;
