"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesContext = void 0;
var react_1 = require("react");
var browser_di_container_1 = require("@src/services/app-di-container/browser-di-container");
/** @private */
exports.ServicesContext = (0, react_1.createContext)(browser_di_container_1.services);
