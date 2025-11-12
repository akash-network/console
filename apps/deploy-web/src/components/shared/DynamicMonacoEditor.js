"use strict";
"use client";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicMonacoEditor = exports.MONACO_OPTIONS = void 0;
var dynamic_1 = require("next/dynamic");
var next_themes_1 = require("next-themes");
exports.MONACO_OPTIONS = {
    selectOnLineNumbers: true,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    scrollbar: {
        verticalScrollbarSize: 8
    },
    minimap: {
        enabled: false
    },
    padding: {
        bottom: 50
    },
    hover: {
        enabled: false
    }
};
var _DynamicMonacoEditor = (0, dynamic_1.default)(function () { return Promise.resolve().then(function () { return require("@monaco-editor/react"); }); }, { ssr: false, loading: function () { return <div>Loading...</div>; } });
var DynamicMonacoEditor = function (_a) {
    var value = _a.value, _b = _a.height, height = _b === void 0 ? "100%" : _b, onChange = _a.onChange, onMount = _a.onMount, _c = _a.language, language = _c === void 0 ? "yaml" : _c, _d = _a.options, options = _d === void 0 ? {} : _d;
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    return (<_DynamicMonacoEditor height={height} language={language} theme={resolvedTheme === "dark" ? "vs-dark" : "hc-light"} value={value} onChange={onChange} options={__assign(__assign({}, exports.MONACO_OPTIONS), options)} onMount={onMount}/>);
};
exports.DynamicMonacoEditor = DynamicMonacoEditor;
