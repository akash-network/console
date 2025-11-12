"use strict";
"use client";
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
exports.useLocalNotes = exports.LocalNoteProvider = void 0;
var react_1 = require("react");
var jotai_1 = require("jotai");
var providerUtils_1 = require("@src/utils/providerUtils");
var ServicesProvider_1 = require("../ServicesProvider");
var settingsStore_1 = require("../SettingsProvider/settingsStore");
var DeploymentNameModal_1 = require("./DeploymentNameModal");
var LocalNoteProviderContext = react_1.default.createContext({});
var LocalNoteProvider = function (_a) {
    var children = _a.children;
    var deploymentLocalStorage = (0, ServicesProvider_1.useServices)().deploymentLocalStorage;
    var _b = (0, react_1.useState)(null), dseq = _b[0], setDseq = _b[1];
    var _c = (0, react_1.useState)([]), favoriteProviders = _c[0], setFavoriteProviders = _c[1];
    var settingsId = (0, jotai_1.useAtom)(settingsStore_1.settingsIdAtom)[0];
    (0, react_1.useEffect)(function () {
        var localProviderData = (0, providerUtils_1.getProviderLocalData)();
        setFavoriteProviders(localProviderData.favorites);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    var updateFavoriteProviders = function (newFavorites) {
        (0, providerUtils_1.updateProviderLocalData)({ favorites: newFavorites });
        setFavoriteProviders(newFavorites);
    };
    var getDeploymentName = function (dseq) {
        var _a;
        var localData = deploymentLocalStorage.get(settingsId, dseq);
        return (_a = localData === null || localData === void 0 ? void 0 : localData.name) !== null && _a !== void 0 ? _a : null;
    };
    var getDeploymentData = function (dseq) {
        var localData = deploymentLocalStorage.get(settingsId, dseq);
        return localData !== null && localData !== void 0 ? localData : null;
    };
    var changeDeploymentName = function (dseq) {
        setDseq(dseq);
    };
    return (<LocalNoteProviderContext.Provider value={{ getDeploymentName: getDeploymentName, changeDeploymentName: changeDeploymentName, getDeploymentData: getDeploymentData, favoriteProviders: favoriteProviders, updateFavoriteProviders: updateFavoriteProviders }}>
      <DeploymentNameModal_1.DeploymentNameModal dseq={dseq} onClose={function () { return setDseq(null); }} onSaved={function () { return setDseq(null); }} getDeploymentName={getDeploymentName}/>
      {children}
    </LocalNoteProviderContext.Provider>);
};
exports.LocalNoteProvider = LocalNoteProvider;
var useLocalNotes = function () {
    return __assign({}, react_1.default.useContext(LocalNoteProviderContext));
};
exports.useLocalNotes = useLocalNotes;
