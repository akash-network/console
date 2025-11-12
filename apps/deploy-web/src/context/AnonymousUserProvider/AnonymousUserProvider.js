"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAnonymousUser = exports.AnonymousUserProvider = void 0;
var react_1 = require("react");
var LoadingBlocker_1 = require("@src/components/layout/LoadingBlocker/LoadingBlocker");
var useStoredAnonymousUser_1 = require("@src/hooks/useStoredAnonymousUser");
var AnonymousUserContext = react_1.default.createContext({});
var AnonymousUserProvider = function (_a) {
    var children = _a.children;
    var _b = (0, useStoredAnonymousUser_1.useStoredAnonymousUser)(), user = _b.user, isLoading = _b.isLoading;
    return (<LoadingBlocker_1.LoadingBlocker isLoading={isLoading}>
      <AnonymousUserContext.Provider value={{ user: user }}>{children}</AnonymousUserContext.Provider>
    </LoadingBlocker_1.LoadingBlocker>);
};
exports.AnonymousUserProvider = AnonymousUserProvider;
var useAnonymousUser = function () { return react_1.default.useContext(AnonymousUserContext); };
exports.useAnonymousUser = useAnonymousUser;
