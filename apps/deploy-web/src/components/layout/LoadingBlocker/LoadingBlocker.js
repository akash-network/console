"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadingBlocker = void 0;
var react_1 = require("react");
var Layout_1 = require("@src/components/layout/Layout");
var LoadingBlocker = function (_a) {
    var children = _a.children, isLoading = _a.isLoading, testId = _a.testId;
    return isLoading ? <Layout_1.Loading text="" testId={testId}/> : <>{children}</>;
};
exports.LoadingBlocker = LoadingBlocker;
