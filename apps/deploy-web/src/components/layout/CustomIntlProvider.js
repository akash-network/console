"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomIntlProvider = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var CustomIntlProvider = function (_a) {
    var children = _a.children;
    var _b = (0, react_1.useState)("en-US"), locale = _b[0], setLocale = _b[1];
    (0, react_1.useEffect)(function () {
        if (navigator === null || navigator === void 0 ? void 0 : navigator.language) {
            setLocale(navigator === null || navigator === void 0 ? void 0 : navigator.language);
        }
    }, []);
    return (<react_intl_1.IntlProvider locale={locale} defaultLocale="en-US">
      {children}
    </react_intl_1.IntlProvider>);
};
exports.CustomIntlProvider = CustomIntlProvider;
