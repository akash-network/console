"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.composeGuards = exports.Guard = void 0;
var Layout_1 = require("@src/components/layout/Layout");
var _404_1 = require("@src/pages/404");
var Guard = function (Component, useCheck, FallbackComponent) {
    if (FallbackComponent === void 0) { FallbackComponent = _404_1.default; }
    var WithGuard = function (props) {
        var _a = useCheck(), canVisit = _a.canVisit, isLoading = _a.isLoading;
        if (isLoading) {
            return <Layout_1.Loading text=""/>;
        }
        if (canVisit) {
            return <Component {...props}/>;
        }
        return <FallbackComponent />;
    };
    var displayName = Component.displayName || Component.name || "Component";
    WithGuard.displayName = "WithGuard(".concat(displayName, ")");
    return WithGuard;
};
exports.Guard = Guard;
var composeGuards = function () {
    var guards = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        guards[_i] = arguments[_i];
    }
    return function () {
        var canVisit = true;
        var isLoading = false;
        for (var _i = 0, guards_1 = guards; _i < guards_1.length; _i++) {
            var guard = guards_1[_i];
            var result = guard();
            canVisit && (canVisit = result.canVisit);
            isLoading || (isLoading = result.isLoading);
        }
        return { canVisit: canVisit, isLoading: isLoading };
    };
};
exports.composeGuards = composeGuards;
