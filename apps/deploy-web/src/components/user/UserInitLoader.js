"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInitLoader = void 0;
var react_1 = require("react");
var LoadingBlocker_1 = require("@src/components/layout/LoadingBlocker/LoadingBlocker");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var UserInitLoader = function (_a) {
    var children = _a.children;
    var isLoading = (0, useCustomUser_1.useCustomUser)().isLoading;
    return <LoadingBlocker_1.LoadingBlocker isLoading={isLoading}>{children}</LoadingBlocker_1.LoadingBlocker>;
};
exports.UserInitLoader = UserInitLoader;
