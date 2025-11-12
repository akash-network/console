"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deploymentRowSchema = void 0;
var zod_1 = require("zod");
exports.deploymentRowSchema = zod_1.z.object({
    dseq: zod_1.z.string(),
    owner: zod_1.z.string(),
    name: zod_1.z.string(),
    status: zod_1.z.string(),
    escrowBalance: zod_1.z.number(),
    escrowAccount: zod_1.z.object({
        id: zod_1.z.object({
            scope: zod_1.z.string(),
            xid: zod_1.z.string()
        }),
        state: zod_1.z.object({
            owner: zod_1.z.string(),
            state: zod_1.z.string(),
            transferred: zod_1.z.array(zod_1.z.object({
                denom: zod_1.z.string(),
                amount: zod_1.z.string()
            })),
            settled_at: zod_1.z.string(),
            funds: zod_1.z.array(zod_1.z.object({
                denom: zod_1.z.string(),
                amount: zod_1.z.string()
            })),
            deposits: zod_1.z.array(zod_1.z.object({
                owner: zod_1.z.string(),
                height: zod_1.z.string(),
                source: zod_1.z.string(),
                balance: zod_1.z.object({
                    denom: zod_1.z.string(),
                    amount: zod_1.z.string()
                })
            }))
        })
    }),
    createdHeight: zod_1.z.number(),
    cpuUnits: zod_1.z.number(),
    gpuUnits: zod_1.z.number(),
    memoryQuantity: zod_1.z.number(),
    storageQuantity: zod_1.z.number(),
    leases: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        owner: zod_1.z.string(),
        provider: zod_1.z.object({
            owner: zod_1.z.string(),
            name: zod_1.z.string(),
            hostUri: zod_1.z.string(),
            createdHeight: zod_1.z.number(),
            email: zod_1.z.string().nullable(),
            website: zod_1.z.string().nullable(),
            lastCheckDate: zod_1.z.string(),
            deploymentCount: zod_1.z.number(),
            leaseCount: zod_1.z.number(),
            cosmosSdkVersion: zod_1.z.string(),
            akashVersion: zod_1.z.string(),
            ipRegion: zod_1.z.string(),
            ipRegionCode: zod_1.z.string(),
            ipCountry: zod_1.z.string(),
            ipCountryCode: zod_1.z.string(),
            ipLat: zod_1.z.string(),
            ipLon: zod_1.z.string(),
            activeStats: zod_1.z.object({
                cpu: zod_1.z.number(),
                gpu: zod_1.z.number(),
                memory: zod_1.z.number(),
                storage: zod_1.z.number()
            }),
            pendingStats: zod_1.z.object({
                cpu: zod_1.z.number(),
                gpu: zod_1.z.number(),
                memory: zod_1.z.number(),
                storage: zod_1.z.number()
            }),
            availableStats: zod_1.z.object({
                cpu: zod_1.z.number(),
                gpu: zod_1.z.number(),
                memory: zod_1.z.number(),
                storage: zod_1.z.number()
            }),
            uptime1d: zod_1.z.number(),
            uptime7d: zod_1.z.number(),
            uptime30d: zod_1.z.number(),
            isValidVersion: zod_1.z.boolean(),
            isOnline: zod_1.z.boolean(),
            isAudited: zod_1.z.boolean(),
            attributes: zod_1.z.array(zod_1.z.object({
                key: zod_1.z.string(),
                value: zod_1.z.string(),
                auditedBy: zod_1.z.array(zod_1.z.string())
            })),
            host: zod_1.z.string(),
            organization: zod_1.z.string().nullable(),
            statusPage: zod_1.z.string().nullable(),
            locationRegion: zod_1.z.array(zod_1.z.string()),
            country: zod_1.z.string().nullable(),
            city: zod_1.z.string().nullable(),
            timezone: zod_1.z.array(zod_1.z.string()),
            locationType: zod_1.z.array(zod_1.z.string()),
            hostingProvider: zod_1.z.string().nullable(),
            hardwareCpu: zod_1.z.array(zod_1.z.string()),
            hardwareCpuArch: zod_1.z.array(zod_1.z.string()),
            hardwareGpuVendor: zod_1.z.array(zod_1.z.string()),
            hardwareGpuModels: zod_1.z.array(zod_1.z.string()),
            hardwareDisk: zod_1.z.array(zod_1.z.string()),
            featPersistentStorage: zod_1.z.boolean(),
            featPersistentStorageType: zod_1.z.array(zod_1.z.string()),
            hardwareMemory: zod_1.z.array(zod_1.z.string()),
            networkProvider: zod_1.z.string().nullable(),
            networkSpeedDown: zod_1.z.number(),
            networkSpeedUp: zod_1.z.number(),
            tier: zod_1.z.array(zod_1.z.string()),
            featEndpointCustomDomain: zod_1.z.boolean(),
            workloadSupportChia: zod_1.z.boolean(),
            workloadSupportChiaCapabilities: zod_1.z.array(zod_1.z.string()),
            featEndpointIp: zod_1.z.boolean()
        }),
        dseq: zod_1.z.string(),
        gseq: zod_1.z.number(),
        oseq: zod_1.z.number(),
        state: zod_1.z.string(),
        price: zod_1.z.object({
            denom: zod_1.z.string(),
            amount: zod_1.z.string()
        })
    }))
});
