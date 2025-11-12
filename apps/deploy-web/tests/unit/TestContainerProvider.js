"use strict";
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
exports.TestContainerProvider = void 0;
var react_query_1 = require("@tanstack/react-query");
var ServicesProvider_1 = require("@src/context/ServicesProvider/ServicesProvider");
var TestContainerProvider = function (_a) {
    var children = _a.children, services = _a.services;
    var queryClient = new react_query_1.QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false
            }
        }
    });
    var testServices = __assign({ queryClient: function () { return queryClient; } }, services);
    return (<ServicesProvider_1.ServicesProvider services={testServices}>
      <QueryProviderFromDI>{children}</QueryProviderFromDI>
    </ServicesProvider_1.ServicesProvider>);
};
exports.TestContainerProvider = TestContainerProvider;
function QueryProviderFromDI(_a) {
    var children = _a.children;
    var queryClient = (0, ServicesProvider_1.useServices)().queryClient;
    return <react_query_1.QueryClientProvider client={queryClient}>{children}</react_query_1.QueryClientProvider>;
}
