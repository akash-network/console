import { faker } from "@faker-js/faker";

import type { ApiProviderDetail } from "@src/types/provider";

export function buildProvider(overrides?: Partial<ApiProviderDetail>): ApiProviderDetail {
  return {
    owner: `akash${faker.string.alphanumeric({ length: 39 })}`,
    name: `${faker.internet.domainWord()}.${faker.internet.domainWord()}.${faker.internet.domainName()}`,
    hostUri: `https://${faker.internet.domainName()}:8443`,
    createdHeight: faker.number.int({ min: 100000, max: 500000 }),
    email: faker.internet.email(),
    website: faker.internet.url(),
    lastCheckDate: faker.date.recent(),
    deploymentCount: faker.number.int({ min: 0, max: 100 }),
    leaseCount: faker.number.int({ min: 0, max: 100 }),
    cosmosSdkVersion: `0.${faker.number.int({ min: 40, max: 50 })}.${faker.number.int({ min: 0, max: 20 })}`,
    akashVersion: `0.${faker.number.int({ min: 5, max: 10 })}.${faker.number.int({ min: 0, max: 10 })}`,
    ipRegion: faker.location.state(),
    ipRegionCode: faker.location.state({ abbreviated: true }),
    ipCountry: faker.location.country(),
    ipCountryCode: faker.location.countryCode(),
    ipLat: faker.location.latitude().toString(),
    ipLon: faker.location.longitude().toString(),
    stats: {
      cpu: {
        active: faker.number.int({ min: 0, max: 10 }),
        available: faker.number.int({ min: 5000, max: 20000 }),
        pending: faker.number.int({ min: 0, max: 5 })
      },
      gpu: {
        active: faker.number.int({ min: 0, max: 2 }),
        available: faker.number.int({ min: 1, max: 4 }),
        pending: faker.number.int({ min: 0, max: 2 })
      },
      memory: {
        active: faker.number.int({ min: 0, max: 10000000000 }),
        available: faker.number.int({ min: 8000000000, max: 64000000000 }),
        pending: faker.number.int({ min: 0, max: 1000000000 })
      },
      storage: {
        ephemeral: {
          active: faker.number.int({ min: 0, max: 10000000000 }),
          available: faker.number.int({ min: 50000000000, max: 200000000000 }),
          pending: faker.number.int({ min: 0, max: 5000000000 })
        },
        persistent: {
          active: faker.number.int({ min: 0, max: 5000000000 }),
          available: faker.number.int({ min: 10000000000, max: 50000000000 }),
          pending: faker.number.int({ min: 0, max: 2000000000 })
        }
      }
    },
    gpuModels: [
      {
        vendor: "nvidia",
        model: "rtx4000",
        ram: "8Gi",
        interface: "PCIe"
      }
    ],
    uptime1d: faker.number.float({ min: 0.9, max: 1, fractionDigits: 4 }),
    uptime7d: faker.number.float({ min: 0.9, max: 1, fractionDigits: 4 }),
    uptime30d: faker.number.float({ min: 0.9, max: 1, fractionDigits: 4 }),
    isValidVersion: faker.datatype.boolean(),
    isOnline: faker.datatype.boolean(),
    lastOnlineDate: faker.date.recent().toISOString(),
    isAudited: faker.datatype.boolean(),
    attributes: [
      { key: "region", value: "us-east", auditedBy: [faker.string.alphanumeric(42)] },
      { key: "host", value: faker.internet.domainWord(), auditedBy: [faker.string.alphanumeric(42)] },
      { key: "tier", value: "community", auditedBy: [faker.string.alphanumeric(42)] },
      { key: "organization", value: "overclock", auditedBy: [faker.string.alphanumeric(42)] },
      { key: "capabilities/storage/1/class", value: "beta3", auditedBy: [faker.string.alphanumeric(42)] },
      { key: "capabilities/storage/1/persistent", value: "true", auditedBy: [faker.string.alphanumeric(42)] },
      { key: "capabilities/gpu/vendor/nvidia/model/rtx4000", value: "true", auditedBy: [faker.string.alphanumeric(42)] }
    ],
    host: faker.internet.domainWord(),
    organization: faker.company.name(),
    statusPage: null,
    locationRegion: faker.location.state(),
    country: faker.location.countryCode(),
    city: faker.location.city(),
    timezone: faker.location.timeZone(),
    locationType: "",
    hostingProvider: "",
    hardwareCpu: "",
    hardwareCpuArch: "",
    hardwareGpuVendor: "",
    hardwareGpuModels: ["Nvidia Quadro RTX 4000"],
    hardwareDisk: ["hdd"],
    featPersistentStorage: faker.datatype.boolean(),
    featPersistentStorageType: ["hdd"],
    hardwareMemory: "",
    networkProvider: "",
    networkSpeedDown: faker.number.int({ min: 0, max: 1000 }),
    networkSpeedUp: faker.number.int({ min: 0, max: 1000 }),
    tier: "Community hosted provider",
    featEndpointCustomDomain: faker.datatype.boolean(),
    workloadSupportChia: faker.datatype.boolean(),
    workloadSupportChiaCapabilities: [],
    featEndpointIp: faker.datatype.boolean(),
    uptime: [],
    ...overrides
  } as ApiProviderDetail;
}
