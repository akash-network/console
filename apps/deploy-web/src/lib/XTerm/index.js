"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XTerm = void 0;
var react_1 = require("react");
var dynamic_1 = require("next/dynamic");
var _DynamicXTerm = (0, dynamic_1.default)(function () { return Promise.resolve().then(function () { return require("./XTerm"); }); }, { ssr: false });
exports.XTerm = (0, react_1.forwardRef)(function (props, ref) { return <_DynamicXTerm {...props} customRef={ref}/>; });
