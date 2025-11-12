"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RootContainerProvider = void 0;
exports.useRootContainer = useRootContainer;
var react_1 = require("react");
var browser_di_container_1 = require("@src/services/app-di-container/browser-di-container");
var createContainer_1 = require("@src/services/container/createContainer");
var ServicesContext_1 = require("./ServicesContext");
var RootContainerProvider = function (_a) {
    var children = _a.children, services = _a.services;
    var container = services ? (0, createContainer_1.createChildContainer)(browser_di_container_1.services, services) : browser_di_container_1.services;
    return <ServicesContext_1.ServicesContext.Provider value={container}>{children}</ServicesContext_1.ServicesContext.Provider>;
};
exports.RootContainerProvider = RootContainerProvider;
function useRootContainer() {
    return (0, react_1.useContext)(ServicesContext_1.ServicesContext);
}
