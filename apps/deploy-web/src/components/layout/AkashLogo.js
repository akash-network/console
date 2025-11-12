"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AkashLogo = void 0;
var utils_1 = require("@akashnetwork/ui/utils");
var useTheme_1 = require("@src/hooks/useTheme");
var AkashConsoleLogo_1 = require("../icons/AkashConsoleLogo");
var AkashLogo = function (_a) {
    var className = _a.className, _b = _a.size, size = _b === void 0 ? { width: 170, height: 20 } : _b;
    var theme = (0, useTheme_1.default)();
    return theme === "light" ? <AkashConsoleLogo_1.AkashConsoleLogoLight className={(0, utils_1.cn)(className)} size={size}/> : <AkashConsoleLogo_1.AkashConsoleLogoDark className={(0, utils_1.cn)(className)} size={size}/>;
};
exports.AkashLogo = AkashLogo;
