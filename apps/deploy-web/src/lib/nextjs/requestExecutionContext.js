"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestExecutionContext = void 0;
exports.createRequestExecutionContext = createRequestExecutionContext;
var node_async_hooks_1 = require("node:async_hooks");
exports.requestExecutionContext = new node_async_hooks_1.AsyncLocalStorage();
function createRequestExecutionContext(req) {
    return {
        headers: new Headers(req.headers)
    };
}
