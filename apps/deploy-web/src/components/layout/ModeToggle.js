"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModeToggle = ModeToggle;
var React = require("react");
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var next_themes_1 = require("next-themes");
function ModeToggle() {
    var _a = (0, next_themes_1.useTheme)(), setTheme = _a.setTheme, theme = _a.theme;
    var _b = (0, react_1.useState)(false), mounted = _b[0], setMounted = _b[1];
    (0, react_1.useEffect)(function () {
        setMounted(true);
    }, []);
    if (!mounted) {
        return null;
    }
    var onThemeClick = function (theme) {
        setTheme(theme);
        document.cookie = "theme=".concat(theme, "; path=/");
    };
    return (<div className="flex items-center gap-2">
      <components_1.Button variant="ghost" size="icon" className={(0, utils_1.cn)("h-8 w-8", { "text-primary": theme === "light" })} onClick={function () { return onThemeClick("light"); }}>
        <iconoir_react_1.SunLight className="h-5 w-5"/>
        <span className="sr-only">Light theme</span>
      </components_1.Button>
      <components_1.Button variant="ghost" size="icon" className={(0, utils_1.cn)("h-8 w-8", { "text-primary": theme === "dark" })} onClick={function () { return onThemeClick("dark"); }}>
        <iconoir_react_1.HalfMoon className="h-5 w-5"/>
        <span className="sr-only">Dark theme</span>
      </components_1.Button>
      <components_1.Button variant="ghost" size="icon" className={(0, utils_1.cn)("h-8 w-8", { "text-primary": theme === "system" })} onClick={function () { return onThemeClick("system"); }}>
        <iconoir_react_1.SunLight className="h-5 w-5"/>
        <iconoir_react_1.HalfMoon className="absolute h-5 w-5"/>
        <span className="sr-only">System theme</span>
      </components_1.Button>
    </div>);
}
