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
exports.DeploymentStorageService = void 0;
var encoding_1 = require("@src/utils/encoding");
var DeploymentStorageService = /** @class */ (function () {
    function DeploymentStorageService(storage, networkStore) {
        this.storage = storage;
        this.networkStore = networkStore;
    }
    DeploymentStorageService.prototype.get = function (walletAddress, dseq) {
        if (!dseq || !walletAddress)
            return null;
        var key = genKey(this.networkStore.selectedNetworkId, walletAddress, dseq);
        var dataStr = this.storage.getItem(key);
        var data = dataStr ? JSON.parse(dataStr) : null;
        if (data === null || data === void 0 ? void 0 : data.manifestVersion) {
            data.manifestVersion =
                data.manifestVersion && typeof data.manifestVersion === "object" ? createUint8ArrayFromObject(data.manifestVersion) : (0, encoding_1.fromBase64)(data.manifestVersion);
        }
        return data;
    };
    DeploymentStorageService.prototype.set = function (walletAddress, dseq, data) {
        if (!dseq || !walletAddress)
            return;
        var key = genKey(this.networkStore.selectedNetworkId, walletAddress, dseq);
        var dataToSave = __assign({ owner: walletAddress }, data);
        if (dataToSave.manifestVersion) {
            dataToSave.manifestVersion = (0, encoding_1.toBase64)(dataToSave.manifestVersion);
        }
        this.storage.setItem(key, JSON.stringify(dataToSave));
    };
    DeploymentStorageService.prototype.update = function (walletAddress, dseq, data) {
        if (!dseq || !walletAddress)
            return;
        var currentData = this.get(walletAddress, dseq);
        var newData = __assign(__assign({}, currentData), data);
        this.set(walletAddress, dseq, newData);
    };
    DeploymentStorageService.prototype.delete = function (walletAddress, dseq) {
        if (!dseq || !walletAddress)
            return;
        var key = genKey(this.networkStore.selectedNetworkId, walletAddress, dseq);
        this.storage.removeItem(key);
    };
    return DeploymentStorageService;
}());
exports.DeploymentStorageService = DeploymentStorageService;
function genKey(networkId, walletAddress, dseq) {
    return "".concat(networkId, "/").concat(walletAddress, "/deployments/").concat(dseq, ".data");
}
function createUint8ArrayFromObject(obj) {
    var keys = Object.keys(obj);
    var data = new Array(keys.length);
    keys.forEach(function (key) {
        data[Number(key)] = obj[key];
    });
    return new Uint8Array(data);
}
