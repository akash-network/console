"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLocalStorage = void 0;
var react_1 = require("react");
var jotai_1 = require("jotai");
var RootContainerProvider_1 = require("@src/context/ServicesProvider/RootContainerProvider");
var settingsStore_1 = require("@src/context/SettingsProvider/settingsStore");
var useLocalStorage = function () {
    var settingsId = (0, jotai_1.useAtom)(settingsStore_1.settingsIdAtom)[0];
    var networkStore = (0, RootContainerProvider_1.useRootContainer)().networkStore;
    var selectedNetworkId = networkStore.useSelectedNetworkId();
    return (0, react_1.useMemo)(function () { return ({
        removeLocalStorageItem: function (key) {
            localStorage.removeItem("".concat(selectedNetworkId).concat(settingsId ? "/" + settingsId : "", "/").concat(key));
        },
        setLocalStorageItem: function (key, value) {
            localStorage.setItem("".concat(selectedNetworkId).concat(settingsId ? "/" + settingsId : "", "/").concat(key), value);
        },
        getLocalStorageItem: function (key) {
            return localStorage.getItem("".concat(selectedNetworkId).concat(settingsId ? "/" + settingsId : "", "/").concat(key));
        }
    }); }, [selectedNetworkId, settingsId]);
};
exports.useLocalStorage = useLocalStorage;
