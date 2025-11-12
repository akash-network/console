"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useInjectedConfig = useInjectedConfig;
var react_1 = require("react");
var decodeInjectedConfig_1 = require("@src/services/decodeInjectedConfig/decodeInjectedConfig");
/**
 * This hook is used to get the injected and verified config from the window object.
 */
function useInjectedConfig(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.decodeConfig, decodeConfig = _c === void 0 ? decodeInjectedConfig_1.decodeInjectedConfig : _c, _d = _b.hasConfig, hasConfig = _d === void 0 ? decodeInjectedConfig_1.hasInjectedConfig : _d;
    var _e = (0, react_1.useState)(false), isLoaded = _e[0], setIsLoaded = _e[1];
    var _f = (0, react_1.useState)(null), config = _f[0], setConfig = _f[1];
    (0, react_1.useEffect)(function () {
        if (hasConfig()) {
            decodeConfig()
                .then(setConfig)
                .finally(function () { return setIsLoaded(true); });
        }
        else {
            setIsLoaded(true);
        }
    }, []);
    return { config: config, isLoaded: isLoaded };
}
