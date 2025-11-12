"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useNavigationGuard = void 0;
var react_1 = require("react");
var context_1 = require("@akashnetwork/ui/context");
var next_navigation_guard_1 = require("next-navigation-guard");
var DEPENDENCIES = {
    useNavigationGuard: next_navigation_guard_1.useNavigationGuard,
    usePopup: context_1.usePopup
};
var useNavigationGuard = function (_a) {
    var _b = _a === void 0 ? {} : _a, enabled = _b.enabled, message = _b.message, skipWhen = _b.skipWhen, _c = _b.dependencies, d = _c === void 0 ? DEPENDENCIES : _c;
    var confirm = d.usePopup().confirm;
    var _d = (0, react_1.useState)(enabled), isToggleEnabled = _d[0], setIsToggleEnabled = _d[1];
    var isEnabled = (0, react_1.useMemo)(function () { return enabled !== null && enabled !== void 0 ? enabled : isToggleEnabled; }, [isToggleEnabled, enabled]);
    d.useNavigationGuard({
        enabled: isEnabled,
        confirm: function (params) {
            if (skipWhen === null || skipWhen === void 0 ? void 0 : skipWhen(params)) {
                return true;
            }
            return confirm(message || "You have unsaved changes. Are you sure you want to leave?");
        }
    });
    return (0, react_1.useMemo)(function () { return ({
        toggle: function (options) {
            if (typeof enabled === "undefined") {
                setIsToggleEnabled(typeof options === "boolean" ? options : options.hasChanges);
            }
            else {
                console.warn("can't toggle enabled state when enabled prop is provided");
            }
        }
    }); }, [enabled]);
};
exports.useNavigationGuard = useNavigationGuard;
