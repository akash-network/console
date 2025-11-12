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
exports.nextCases = exports.defaultAnyRegion = exports.defaultRentGpuService = exports.defaultSshVMService = exports.SSH_EXPOSE = exports.sshVmImages = exports.sshVmDistros = exports.SSH_VM_IMAGES = exports.defaultRamStorage = exports.defaultPersistentStorage = exports.defaultService = exports.defaultHttpOptions = exports.protoTypes = void 0;
var nanoid_1 = require("nanoid");
exports.protoTypes = [
    { id: 1, name: "http" },
    // { id: 2, name: "https" },
    { id: 3, name: "tcp" }
];
exports.defaultHttpOptions = {
    maxBodySize: 1048576,
    readTimeout: 60000,
    sendTimeout: 60000,
    nextCases: ["error", "timeout"],
    nextTries: 3,
    nextTimeout: 60000
};
exports.defaultService = {
    id: (0, nanoid_1.nanoid)(),
    title: "service-1",
    image: "",
    sshPubKey: "",
    profile: {
        cpu: 0.1,
        gpu: 1,
        gpuModels: [{ vendor: "nvidia" }],
        hasGpu: false,
        ram: 512,
        ramUnit: "Mi",
        storage: [
            {
                size: 1,
                unit: "Gi",
                isPersistent: false,
                type: "beta2"
            }
        ]
    },
    expose: [
        {
            id: (0, nanoid_1.nanoid)(),
            port: 80,
            as: 80,
            proto: "http",
            global: true,
            to: [],
            accept: [],
            ipName: "",
            httpOptions: {
                maxBodySize: exports.defaultHttpOptions.maxBodySize,
                readTimeout: exports.defaultHttpOptions.readTimeout,
                sendTimeout: exports.defaultHttpOptions.sendTimeout,
                nextCases: exports.defaultHttpOptions.nextCases,
                nextTries: exports.defaultHttpOptions.nextTries,
                nextTimeout: exports.defaultHttpOptions.nextTimeout
            }
        }
    ],
    command: { command: "", arg: "" },
    env: [],
    placement: {
        name: "dcloud",
        pricing: {
            amount: 100000,
            denom: "uakt"
        },
        signedBy: {
            anyOf: [],
            allOf: []
        },
        attributes: []
    },
    count: 1
};
exports.defaultPersistentStorage = {
    size: 10,
    unit: "Gi",
    isPersistent: true,
    type: "beta3",
    name: "data",
    mount: "/mnt/data",
    isReadOnly: false
};
exports.defaultRamStorage = {
    size: 10,
    unit: "Gi",
    isPersistent: false,
    type: "ram",
    name: "shm",
    mount: "/dev/shm",
    isReadOnly: false
};
exports.SSH_VM_IMAGES = {
    "Ubuntu 24.04": "ghcr.io/akash-network/ubuntu-2404-ssh:2",
    "CentOS Stream 9": "ghcr.io/akash-network/centos-stream9-ssh:2",
    "Debian 11": "ghcr.io/akash-network/debian-11-ssh:2",
    "SuSE Leap 15.5": "ghcr.io/akash-network/opensuse-leap-155-ssh:2"
};
exports.sshVmDistros = Object.keys(exports.SSH_VM_IMAGES);
exports.sshVmImages = new Set(Object.values(exports.SSH_VM_IMAGES));
exports.SSH_EXPOSE = {
    port: 22,
    as: 22,
    global: true,
    to: []
};
exports.defaultSshVMService = __assign(__assign({}, exports.defaultService), { image: exports.sshVmDistros[0], expose: [] });
exports.defaultRentGpuService = {
    id: (0, nanoid_1.nanoid)(),
    title: "service-1",
    image: "",
    profile: {
        cpu: 0.1,
        gpu: 1,
        gpuModels: [{ vendor: "nvidia" }],
        hasGpu: true,
        ram: 512,
        ramUnit: "Mi",
        storage: [
            {
                size: 1,
                unit: "Gi",
                isPersistent: false
            }
        ]
    },
    expose: [
        {
            id: (0, nanoid_1.nanoid)(),
            port: 80,
            as: 80,
            proto: "http",
            global: true,
            to: [],
            accept: [],
            ipName: "",
            httpOptions: {
                maxBodySize: exports.defaultHttpOptions.maxBodySize,
                readTimeout: exports.defaultHttpOptions.readTimeout,
                sendTimeout: exports.defaultHttpOptions.sendTimeout,
                nextCases: exports.defaultHttpOptions.nextCases,
                nextTries: exports.defaultHttpOptions.nextTries,
                nextTimeout: exports.defaultHttpOptions.nextTimeout
            }
        }
    ],
    command: { command: "", arg: "" },
    env: [],
    placement: {
        name: "dcloud",
        pricing: {
            amount: 100000,
            denom: "uakt"
        },
        signedBy: {
            anyOf: [],
            allOf: []
        },
        attributes: []
    },
    count: 1
};
exports.defaultAnyRegion = {
    key: "any",
    value: "any",
    description: "Any region"
};
exports.nextCases = [
    { value: "error", label: "error" },
    { value: "timeout", label: "timeout" },
    { value: "403", label: "403" },
    { value: "404", label: "404" },
    { value: "429", label: "429" },
    { value: "500", label: "500" },
    { value: "502", label: "502" },
    { value: "503", label: "503" },
    { value: "504", label: "504" },
    { value: "off", label: "off" }
];
