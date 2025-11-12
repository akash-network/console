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
var jest_mock_extended_1 = require("jest-mock-extended");
var encoding_1 = require("@src/utils/encoding");
var deployment_storage_service_1 = require("./deployment-storage.service");
describe(deployment_storage_service_1.DeploymentStorageService.name, function () {
    var walletAddress = "akash1234567890abcdef";
    var dseq = "12345";
    describe("get", function () {
        it("returns null when dseq is falsy", function () {
            var service = setup().service;
            expect(service.get(walletAddress, null)).toBeNull();
            expect(service.get(walletAddress, undefined)).toBeNull();
            expect(service.get(walletAddress, "")).toBeNull();
        });
        it("returns null when walletAddress is falsy", function () {
            var service = setup().service;
            expect(service.get(null, dseq)).toBeNull();
            expect(service.get(undefined, dseq)).toBeNull();
            expect(service.get("", dseq)).toBeNull();
        });
        it("returns null when both walletAddress and dseq are falsy", function () {
            var service = setup().service;
            expect(service.get(null, null)).toBeNull();
        });
        it("returns null when item does not exist in storage", function () {
            var _a = setup(), service = _a.service, storage = _a.storage, genKey = _a.genKey;
            storage.getItem.mockReturnValue(null);
            var result = service.get(walletAddress, dseq);
            expect(result).toBeNull();
            expect(storage.getItem).toHaveBeenCalledWith(genKey(walletAddress, dseq));
        });
        it("returns deployment data when item exists in storage", function () {
            var _a = setup(), service = _a.service, storage = _a.storage, genKey = _a.genKey;
            var manifestVersion = new Uint8Array([1, 2, 3, 4, 5]);
            var mockData = {
                owner: walletAddress,
                name: "test-deployment",
                manifest: "version: '2.0'",
                manifestVersion: manifestVersion
            };
            var storedData = __assign(__assign({}, mockData), { manifestVersion: (0, encoding_1.toBase64)(manifestVersion) });
            storage.getItem.mockReturnValue(JSON.stringify(storedData));
            var result = service.get(walletAddress, dseq);
            expect(result).toEqual(mockData);
            expect(storage.getItem).toHaveBeenCalledWith(genKey(walletAddress, dseq));
        });
        it("handles manifestVersion as object and converts to Uint8Array (legacy format in storage)", function () {
            var _a = setup(), service = _a.service, storage = _a.storage;
            var manifestVersionAsObject = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 };
            var storedData = {
                owner: walletAddress,
                name: "test-deployment",
                manifest: "version: '2.0'",
                manifestVersion: manifestVersionAsObject
            };
            storage.getItem.mockReturnValue(JSON.stringify(storedData));
            var result = service.get(walletAddress, dseq);
            expect(result).toBeDefined();
            expect(result === null || result === void 0 ? void 0 : result.manifestVersion).toBeInstanceOf(Uint8Array);
            expect(Array.from(result.manifestVersion)).toEqual([1, 2, 3, 4, 5]);
        });
        it("handles manifestVersion as base64 string and converts to Uint8Array", function () {
            var _a = setup(), service = _a.service, storage = _a.storage;
            var manifestVersion = new Uint8Array([1, 2, 3, 4, 5]);
            var base64ManifestVersion = (0, encoding_1.toBase64)(manifestVersion);
            var storedData = {
                owner: walletAddress,
                name: "test-deployment",
                manifest: "version: '2.0'",
                manifestVersion: base64ManifestVersion
            };
            storage.getItem.mockReturnValue(JSON.stringify(storedData));
            var result = service.get(walletAddress, dseq);
            expect(result).toBeDefined();
            expect(result === null || result === void 0 ? void 0 : result.manifestVersion).toBeInstanceOf(Uint8Array);
            expect(result === null || result === void 0 ? void 0 : result.manifestVersion).toEqual(manifestVersion);
        });
    });
    describe("set", function () {
        it("does nothing when dseq or walletAddress is falsy", function () {
            var _a = setup(), service = _a.service, storage = _a.storage;
            var data = {
                name: "test-deployment",
                manifest: "version: '2.0'",
                manifestVersion: new Uint8Array([1, 2, 3, 4, 5])
            };
            service.set(walletAddress, null, data);
            service.set(walletAddress, undefined, data);
            service.set(walletAddress, "", data);
            service.set(null, dseq, data);
            service.set(undefined, dseq, data);
            service.set("", dseq, data);
            service.set("", undefined, data);
            expect(storage.setItem).not.toHaveBeenCalled();
        });
        it("stores deployment data with owner and base64 encoded manifestVersion", function () {
            var _a = setup(), service = _a.service, storage = _a.storage, genKey = _a.genKey;
            var manifestVersion = new Uint8Array([1, 2, 3, 4, 5]);
            var data = {
                name: "test-deployment",
                manifest: "version: '2.0'",
                manifestVersion: manifestVersion
            };
            service.set(walletAddress, dseq, data);
            var expectedKey = genKey(walletAddress, dseq);
            var expectedData = {
                owner: walletAddress,
                name: data.name,
                manifest: data.manifest,
                manifestVersion: (0, encoding_1.toBase64)(manifestVersion)
            };
            expect(storage.setItem).toHaveBeenCalledWith(expectedKey, JSON.stringify(expectedData));
        });
    });
    describe("update", function () {
        it("does nothing when dseq or walletAddress is falsy", function () {
            var _a = setup(), service = _a.service, storage = _a.storage;
            var data = { name: "updated-name" };
            service.update(walletAddress, null, data);
            service.update(walletAddress, undefined, data);
            service.update(walletAddress, "", data);
            service.update(null, dseq, data);
            service.update(undefined, dseq, data);
            service.update("", dseq, data);
            expect(storage.getItem).not.toHaveBeenCalled();
            expect(storage.setItem).not.toHaveBeenCalled();
        });
        it("sets the value when current data does not exist", function () {
            var _a = setup(), service = _a.service, storage = _a.storage;
            storage.getItem.mockReturnValue(null);
            var data = { name: "updated-name" };
            service.update(walletAddress, dseq, data);
            expect(storage.getItem).toHaveBeenCalled();
            expect(storage.setItem).toHaveBeenCalledWith(expect.any(String), JSON.stringify({ owner: walletAddress, name: "updated-name" }));
        });
        it("updates existing deployment data", function () {
            var _a = setup(), service = _a.service, storage = _a.storage, genKey = _a.genKey;
            var manifestVersion = new Uint8Array([1, 2, 3, 4, 5]);
            var existingData = {
                owner: walletAddress,
                name: "old-name",
                manifest: "version: '2.0'",
                manifestVersion: manifestVersion
            };
            var storedData = __assign(__assign({}, existingData), { manifestVersion: (0, encoding_1.toBase64)(manifestVersion) });
            storage.getItem.mockReturnValue(JSON.stringify(storedData));
            service.update(walletAddress, dseq, { name: "updated-name" });
            var expectedKey = genKey(walletAddress, dseq);
            var expectedData = {
                owner: walletAddress,
                name: "updated-name",
                manifest: existingData.manifest,
                manifestVersion: (0, encoding_1.toBase64)(manifestVersion)
            };
            expect(storage.setItem).toHaveBeenCalledWith(expectedKey, JSON.stringify(expectedData));
        });
        it("updates multiple fields in existing deployment data", function () {
            var _a = setup(), service = _a.service, storage = _a.storage, genKey = _a.genKey;
            var manifestVersion = new Uint8Array([1, 2, 3, 4, 5]);
            var existingData = {
                owner: walletAddress,
                name: "old-name",
                manifest: "version: '2.0'",
                manifestVersion: manifestVersion
            };
            var storedData = __assign(__assign({}, existingData), { manifestVersion: (0, encoding_1.toBase64)(manifestVersion) });
            storage.getItem.mockReturnValue(JSON.stringify(storedData));
            var newManifestVersion = new Uint8Array([6, 7, 8, 9, 10]);
            service.update(walletAddress, dseq, {
                name: "updated-name",
                manifest: "version: '3.0'",
                manifestVersion: newManifestVersion
            });
            var expectedKey = genKey(walletAddress, dseq);
            var expectedData = {
                owner: walletAddress,
                name: "updated-name",
                manifest: "version: '3.0'",
                manifestVersion: (0, encoding_1.toBase64)(newManifestVersion)
            };
            expect(storage.setItem).toHaveBeenCalledWith(expectedKey, JSON.stringify(expectedData));
        });
    });
    describe("delete", function () {
        it("does nothing when dseq is not provided", function () {
            var _a = setup(), service = _a.service, storage = _a.storage;
            service.delete(walletAddress, null);
            service.delete(walletAddress, undefined);
            service.delete(walletAddress, "");
            expect(storage.removeItem).not.toHaveBeenCalled();
        });
        it("does nothing when walletAddress is not provided", function () {
            var _a = setup(), service = _a.service, storage = _a.storage;
            service.delete(null, dseq);
            service.delete(undefined, dseq);
            service.delete("", dseq);
            expect(storage.removeItem).not.toHaveBeenCalled();
        });
        it("removes deployment data from storage", function () {
            var _a = setup(), service = _a.service, storage = _a.storage, genKey = _a.genKey;
            service.delete(walletAddress, dseq);
            var expectedKey = genKey(walletAddress, dseq);
            expect(storage.removeItem).toHaveBeenCalledWith(expectedKey);
        });
    });
    function setup() {
        var storage = (0, jest_mock_extended_1.mock)();
        var networkId = "testnet";
        var networkStore = (0, jest_mock_extended_1.mock)({
            selectedNetworkId: networkId
        });
        var service = new deployment_storage_service_1.DeploymentStorageService(storage, networkStore);
        return {
            service: service,
            storage: storage,
            networkStore: networkStore,
            genKey: function (walletAddress, dseq) { return "".concat(networkId, "/").concat(walletAddress, "/deployments/").concat(dseq, ".data"); }
        };
    }
});
