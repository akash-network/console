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
exports.buildProvider = buildProvider;
var faker_1 = require("@faker-js/faker");
var wallet_1 = require("./wallet");
function buildProvider(overrides) {
    return __assign({ owner: (0, wallet_1.genWalletAddress)(), name: "".concat(faker_1.faker.internet.domainWord(), ".").concat(faker_1.faker.internet.domainWord(), ".").concat(faker_1.faker.internet.domainName()), hostUri: "https://".concat(faker_1.faker.internet.domainName(), ":8443"), createdHeight: faker_1.faker.number.int({ min: 100000, max: 500000 }), email: faker_1.faker.internet.email(), website: faker_1.faker.internet.url(), lastCheckDate: faker_1.faker.date.recent(), deploymentCount: faker_1.faker.number.int({ min: 0, max: 100 }), leaseCount: faker_1.faker.number.int({ min: 0, max: 100 }), cosmosSdkVersion: "0.".concat(faker_1.faker.number.int({ min: 40, max: 50 }), ".").concat(faker_1.faker.number.int({ min: 0, max: 20 })), akashVersion: "0.".concat(faker_1.faker.number.int({ min: 5, max: 10 }), ".").concat(faker_1.faker.number.int({ min: 0, max: 10 })), ipRegion: faker_1.faker.location.state(), ipRegionCode: faker_1.faker.location.state({ abbreviated: true }), ipCountry: faker_1.faker.location.country(), ipCountryCode: faker_1.faker.location.countryCode(), ipLat: faker_1.faker.location.latitude().toString(), ipLon: faker_1.faker.location.longitude().toString(), stats: {
            cpu: {
                active: faker_1.faker.number.int({ min: 0, max: 10 }),
                available: faker_1.faker.number.int({ min: 5000, max: 20000 }),
                pending: faker_1.faker.number.int({ min: 0, max: 5 })
            },
            gpu: {
                active: faker_1.faker.number.int({ min: 0, max: 2 }),
                available: faker_1.faker.number.int({ min: 1, max: 4 }),
                pending: faker_1.faker.number.int({ min: 0, max: 2 })
            },
            memory: {
                active: faker_1.faker.number.int({ min: 0, max: 10000000000 }),
                available: faker_1.faker.number.int({ min: 8000000000, max: 64000000000 }),
                pending: faker_1.faker.number.int({ min: 0, max: 1000000000 })
            },
            storage: {
                ephemeral: {
                    active: faker_1.faker.number.int({ min: 0, max: 10000000000 }),
                    available: faker_1.faker.number.int({ min: 50000000000, max: 200000000000 }),
                    pending: faker_1.faker.number.int({ min: 0, max: 5000000000 })
                },
                persistent: {
                    active: faker_1.faker.number.int({ min: 0, max: 5000000000 }),
                    available: faker_1.faker.number.int({ min: 10000000000, max: 50000000000 }),
                    pending: faker_1.faker.number.int({ min: 0, max: 2000000000 })
                }
            }
        }, gpuModels: [
            {
                vendor: "nvidia",
                model: "rtx4000",
                ram: "8Gi",
                interface: "PCIe"
            }
        ], uptime1d: faker_1.faker.number.float({ min: 0.9, max: 1, fractionDigits: 4 }), uptime7d: faker_1.faker.number.float({ min: 0.9, max: 1, fractionDigits: 4 }), uptime30d: faker_1.faker.number.float({ min: 0.9, max: 1, fractionDigits: 4 }), isValidVersion: faker_1.faker.datatype.boolean(), isOnline: faker_1.faker.datatype.boolean(), lastOnlineDate: faker_1.faker.date.recent().toISOString(), isAudited: faker_1.faker.datatype.boolean(), attributes: [
            { key: "region", value: "us-east", auditedBy: [faker_1.faker.string.alphanumeric(42)] },
            { key: "host", value: faker_1.faker.internet.domainWord(), auditedBy: [faker_1.faker.string.alphanumeric(42)] },
            { key: "tier", value: "community", auditedBy: [faker_1.faker.string.alphanumeric(42)] },
            { key: "organization", value: "overclock", auditedBy: [faker_1.faker.string.alphanumeric(42)] },
            { key: "capabilities/storage/1/class", value: "beta3", auditedBy: [faker_1.faker.string.alphanumeric(42)] },
            { key: "capabilities/storage/1/persistent", value: "true", auditedBy: [faker_1.faker.string.alphanumeric(42)] },
            { key: "capabilities/gpu/vendor/nvidia/model/rtx4000", value: "true", auditedBy: [faker_1.faker.string.alphanumeric(42)] }
        ], host: faker_1.faker.internet.domainWord(), organization: faker_1.faker.company.name(), statusPage: null, locationRegion: faker_1.faker.location.state(), country: faker_1.faker.location.countryCode(), city: faker_1.faker.location.city(), timezone: faker_1.faker.location.timeZone(), locationType: "", hostingProvider: "", hardwareCpu: "", hardwareCpuArch: "", hardwareGpuVendor: "", hardwareGpuModels: ["Nvidia Quadro RTX 4000"], hardwareDisk: ["hdd"], featPersistentStorage: faker_1.faker.datatype.boolean(), featPersistentStorageType: ["hdd"], hardwareMemory: "", networkProvider: "", networkSpeedDown: faker_1.faker.number.int({ min: 0, max: 1000 }), networkSpeedUp: faker_1.faker.number.int({ min: 0, max: 1000 }), tier: "Community hosted provider", featEndpointCustomDomain: faker_1.faker.datatype.boolean(), workloadSupportChia: faker_1.faker.datatype.boolean(), workloadSupportChiaCapabilities: [], featEndpointIp: faker_1.faker.datatype.boolean(), uptime: [] }, overrides);
}
