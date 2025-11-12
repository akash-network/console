"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisteredUsersOnly = void 0;
var react_1 = require("react");
var useUser_1 = require("@src/hooks/useUser");
var _404_1 = require("@src/pages/404");
var RegisteredUsersOnly = function (Component, FallbackComponent) {
    if (FallbackComponent === void 0) { FallbackComponent = _404_1.default; }
    var WithRegisteredUsersOnly = function (props) {
        var user = (0, useUser_1.useUser)().user;
        var isRegistered = !!(user === null || user === void 0 ? void 0 : user.userId);
        if (isRegistered) {
            return <Component {...props}/>;
        }
        return <FallbackComponent />;
    };
    var displayName = Component.displayName || Component.name || "Component";
    WithRegisteredUsersOnly.displayName = "RegisteredUsersOnly(".concat(displayName, ")");
    return WithRegisteredUsersOnly;
};
exports.RegisteredUsersOnly = RegisteredUsersOnly;
