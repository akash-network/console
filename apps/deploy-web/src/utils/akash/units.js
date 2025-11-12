"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ephemeralStorageTypes = exports.persistentStorageTypes = exports.storageUnits = exports.memoryUnits = exports.validationConfig = void 0;
//github.com/akash-network/akash-api/blob/d05c262a17178a33e3e5383dcceea384d6260a17/go/node/deployment/v1beta3/validation_config.go
var maxUnitCPU = 384;
var maxUnitGPU = 24;
var maxUnitMemory = 2 * Math.pow(1024, 4); // 2 Ti
var maxUnitStorage = 32 * Math.pow(1024, 4); // 32 Ti
var maxUnitCount = 50;
var maxGroupCount = 20;
var maxGroupUnits = 20;
exports.validationConfig = {
    maxCpuAmount: maxUnitCPU,
    maxGroupCpuCount: maxUnitCPU * maxUnitCount,
    maxGpuAmount: maxUnitGPU,
    maxGroupGpuCount: maxUnitGPU * maxUnitCount,
    minMemory: 1024, // 1 Mi
    minStorage: 5 * 1024, // 5 Mi
    maxMemory: maxUnitMemory,
    maxGroupMemory: maxUnitMemory * maxUnitCount,
    maxStorage: maxUnitStorage,
    maxGroupStorage: maxUnitStorage * maxUnitCount,
    maxGroupCount: maxGroupCount,
    maxGroupUnits: maxGroupUnits
};
exports.memoryUnits = [
    { id: 3, suffix: "MB", value: Math.pow(1000, 2) },
    { id: 4, suffix: "Mi", value: Math.pow(1024, 2) },
    { id: 5, suffix: "GB", value: Math.pow(1000, 3) },
    { id: 6, suffix: "Gi", value: Math.pow(1024, 3) }
];
exports.storageUnits = [
    { id: 3, suffix: "MB", value: Math.pow(1000, 2) },
    { id: 4, suffix: "Mi", value: Math.pow(1024, 2) },
    { id: 5, suffix: "GB", value: Math.pow(1000, 3) },
    { id: 6, suffix: "Gi", value: Math.pow(1024, 3) },
    { id: 7, suffix: "TB", value: Math.pow(1000, 4) },
    { id: 8, suffix: "Ti", value: Math.pow(1024, 4) }
];
exports.persistentStorageTypes = [
    { id: 1, className: "beta1", name: "HDD" },
    { id: 2, className: "beta2", name: "SSD" },
    { id: 3, className: "beta3", name: "NVMe" }
];
exports.ephemeralStorageTypes = __spreadArray(__spreadArray([], exports.persistentStorageTypes, true), [{ id: 4, className: "ram", name: "RAM" }], false);
