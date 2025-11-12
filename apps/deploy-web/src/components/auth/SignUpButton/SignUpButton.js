"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignUpButton = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var link_1 = require("next/link");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var SignUpButton = function (_a) {
    var children = _a.children, className = _a.className, _b = _a.wrapper, wrapper = _b === void 0 ? "link" : _b, props = __rest(_a, ["children", "className", "wrapper"]);
    var authService = (0, ServicesProvider_1.useServices)().authService;
    var _c = (0, react_1.useState)(false), isLoading = _c[0], setIsLoading = _c[1];
    var signup = (0, react_1.useCallback)(function (event) {
        event.preventDefault();
        setIsLoading(true);
        authService.signup().finally(function () { return setIsLoading(false); });
    }, []);
    var content = children || "Sign up";
    switch (wrapper) {
        case "button":
            return (<components_1.Button className={className} onClick={signup} disabled={isLoading} {...props}>
          {content}
        </components_1.Button>);
        default:
            return (<link_1.default href="#" passHref prefetch={false} className={className} onClick={signup} aria-disabled={isLoading} {...props}>
          {content}
        </link_1.default>);
    }
};
exports.SignUpButton = SignUpButton;
