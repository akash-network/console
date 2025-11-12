"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalDataManagerContainer = void 0;
var react_1 = require("react");
var LocalDataManager_component_1 = require("./LocalDataManager.component");
var LocalDataManagerContainer = function () {
    var importLocalData = (0, react_1.useCallback)(function (data) {
        Object.keys(data).forEach(function (key) {
            localStorage.setItem(key, data[key]);
        });
    }, []);
    var readLocalData = (0, react_1.useCallback)(function () {
        return localStorage;
    }, []);
    var reload = function () { return window.location.reload(); };
    return <LocalDataManager_component_1.LocalDataManagerComponent read={readLocalData} write={importLocalData} onDone={reload}/>;
};
exports.LocalDataManagerContainer = LocalDataManagerContainer;
