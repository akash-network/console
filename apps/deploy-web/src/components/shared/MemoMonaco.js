"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoMonaco = void 0;
var react_1 = require("react");
var isEqual_1 = require("lodash/isEqual");
var DynamicMonacoEditor_1 = require("./DynamicMonacoEditor");
var _MemoMonaco = function (_a) {
    var value = _a.value, onChange = _a.onChange, onMount = _a.onMount, language = _a.language, _b = _a.options, options = _b === void 0 ? {} : _b;
    return <DynamicMonacoEditor_1.DynamicMonacoEditor value={value} options={options} onChange={onChange} onMount={onMount} language={language}/>;
};
exports.MemoMonaco = react_1.default.memo(_MemoMonaco, function (prevProps, nextProps) {
    return (0, isEqual_1.default)(prevProps, nextProps);
});
