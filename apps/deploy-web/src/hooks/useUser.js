"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useIsRegisteredUser = exports.useUser = void 0;
var react_1 = require("react");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var useStoredAnonymousUser_1 = require("@src/hooks/useStoredAnonymousUser");
var useUser = function () {
    var _a = (0, useCustomUser_1.useCustomUser)(), registeredUser = _a.user, isLoadingRegisteredUser = _a.isLoading;
    var _b = (0, useStoredAnonymousUser_1.useStoredAnonymousUser)(), anonymousUser = _b.user, isLoadingAnonymousUser = _b.isLoading;
    var user = (0, react_1.useMemo)(function () { return registeredUser || anonymousUser; }, [registeredUser, anonymousUser]);
    var isLoading = (0, react_1.useMemo)(function () { return isLoadingRegisteredUser || isLoadingAnonymousUser; }, [isLoadingRegisteredUser, isLoadingAnonymousUser]);
    return {
        user: user,
        isLoading: isLoading
    };
};
exports.useUser = useUser;
var useIsRegisteredUser = function () {
    var _a = (0, exports.useUser)(), isLoading = _a.isLoading, user = _a.user;
    return {
        isLoading: isLoading,
        canVisit: !!user.userId
    };
};
exports.useIsRegisteredUser = useIsRegisteredUser;
