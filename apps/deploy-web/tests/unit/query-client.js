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
exports.setupQuery = setupQuery;
var react_query_1 = require("@tanstack/react-query");
var TestContainerProvider_1 = require("./TestContainerProvider");
var react_1 = require("@testing-library/react");
function setupQuery(hook, options) {
    var queryClient = new react_query_1.QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false
            }
        }
    });
    var wrapper = createWrapper(__assign({ queryClient: function () { return queryClient; } }, options === null || options === void 0 ? void 0 : options.services));
    var customWrapper = options === null || options === void 0 ? void 0 : options.wrapper;
    if (customWrapper) {
        var originalWrapper_1 = wrapper;
        wrapper = function (props) { return customWrapper({ children: originalWrapper_1(props) }); };
    }
    return (0, react_1.renderHook)(hook, { wrapper: wrapper });
}
function createWrapper(services) {
    return function (_a) {
        var children = _a.children;
        return <TestContainerProvider_1.TestContainerProvider services={services}>{children}</TestContainerProvider_1.TestContainerProvider>;
    };
}
