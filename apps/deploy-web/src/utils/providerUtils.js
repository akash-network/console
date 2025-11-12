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
exports.getProviderNameFromUri = exports.getSnapshotMetadata = void 0;
exports.providerStatusToDto = providerStatusToDto;
exports.getNetworkCapacityDto = getNetworkCapacityDto;
exports.getProviderLocalData = getProviderLocalData;
exports.updateProviderLocalData = updateProviderLocalData;
var networkStore_1 = require("@src/store/networkStore");
var types_1 = require("@src/types");
var unitUtils_1 = require("./unitUtils");
function providerStatusToDto(providerStatus, providerVersion) {
    return {
        name: providerStatus.cluster_public_hostname,
        orderCount: providerStatus.bidengine.orders,
        deploymentCount: providerStatus.manifest.deployments,
        leaseCount: providerStatus.cluster.leases,
        active: providerStatus.cluster.inventory.active,
        available: providerStatus.cluster.inventory.available,
        pending: providerStatus.cluster.inventory.pending,
        error: providerStatus.cluster.inventory.error,
        akash: providerVersion.akash,
        kube: providerVersion.kube
    };
}
function getNetworkCapacityDto(networkCapacity) {
    return __assign(__assign({}, networkCapacity), { activeCPU: networkCapacity.activeCPU / 1000, pendingCPU: networkCapacity.pendingCPU / 1000, availableCPU: networkCapacity.availableCPU / 1000, totalCPU: networkCapacity.totalCPU / 1000 });
}
function getProviderLocalData() {
    var dataStr = localStorage.getItem("".concat(networkStore_1.default.selectedNetworkId, "/provider.data"));
    if (!dataStr) {
        return { favorites: [] };
    }
    var parsedData = JSON.parse(dataStr);
    return parsedData;
}
function updateProviderLocalData(data) {
    var oldData = getProviderLocalData();
    var newData = __assign(__assign({}, oldData), data);
    localStorage.setItem("".concat(networkStore_1.default.selectedNetworkId, "/provider.data"), JSON.stringify(newData));
}
var getSnapshotMetadata = function (snapshot) {
    switch (snapshot) {
        case types_1.ProviderSnapshots.cpu:
            return {
                unitFn: function (x) { return ({ value: x / 1000 }); }
            };
        case types_1.ProviderSnapshots.gpu:
            return {
                unitFn: function (x) { return ({ value: x }); }
            };
        case types_1.ProviderSnapshots.memory:
        case types_1.ProviderSnapshots.storage:
            return {
                unitFn: function (x) {
                    var _ = (0, unitUtils_1.bytesToShrink)(x);
                    return {
                        value: x / 1000 / 1000 / 1000,
                        unit: _.unit,
                        modifiedValue: _.value
                    };
                },
                legend: "GB"
            };
        default:
            return {
                unitFn: function (x) { return ({ value: x }); }
            };
    }
};
exports.getSnapshotMetadata = getSnapshotMetadata;
var getProviderNameFromUri = function (uri) {
    var name = new URL(uri).hostname;
    return name;
};
exports.getProviderNameFromUri = getProviderNameFromUri;
