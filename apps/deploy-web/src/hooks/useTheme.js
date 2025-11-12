"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var next_themes_1 = require("next-themes");
/**
 * Get the theme from the html class which is set from the cookie
 */
var useCookieTheme = function () {
    var _a = (0, react_1.useState)(""), _theme = _a[0], _setTheme = _a[1];
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    (0, react_1.useEffect)(function () {
        if (resolvedTheme) {
            _setTheme(resolvedTheme);
        }
        else {
            _setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
        }
    }, [resolvedTheme]);
    return _theme;
};
exports.default = useCookieTheme;
