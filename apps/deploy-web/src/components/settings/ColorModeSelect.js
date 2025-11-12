"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColorModeSelect = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var next_themes_1 = require("next-themes");
var ColorModeSelect = function () {
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
    return (<components_1.FormItem>
      <components_1.Label>Theme</components_1.Label>
      <components_1.Select value={theme} onValueChange={onThemeClick}>
        <components_1.SelectTrigger>
          <components_1.SelectValue placeholder="Select theme"/>
        </components_1.SelectTrigger>
        <components_1.SelectContent>
          <components_1.SelectGroup>
            <components_1.SelectItem value="system">System</components_1.SelectItem>
            <components_1.SelectItem value="dark">Dark 🌑</components_1.SelectItem>
            <components_1.SelectItem value="light">Light ☀️</components_1.SelectItem>
          </components_1.SelectGroup>
        </components_1.SelectContent>
      </components_1.Select>
    </components_1.FormItem>);
};
exports.ColorModeSelect = ColorModeSelect;
