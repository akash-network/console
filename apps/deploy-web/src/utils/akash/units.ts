//github.com/akash-network/akash-api/blob/d05c262a17178a33e3e5383dcceea384d6260a17/go/node/deployment/v1beta3/validation_config.go
const maxUnitCPU = 384;
const maxUnitGPU = 24;
const maxUnitMemory = 2 * 1024 ** 4; // 2 Ti
const maxUnitStorage = 32 * 1024 ** 4; // 32 Ti
const maxUnitCount = 50;
const maxGroupCount = 20;
const maxGroupUnits = 20;

export const validationConfig = {
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

export const memoryUnits = [
  { id: 3, suffix: "MB", value: 1000 ** 2 },
  { id: 4, suffix: "Mi", value: 1024 ** 2 },
  { id: 5, suffix: "GB", value: 1000 ** 3 },
  { id: 6, suffix: "Gi", value: 1024 ** 3 }
];

export const storageUnits = [
  { id: 3, suffix: "MB", value: 1000 ** 2 },
  { id: 4, suffix: "Mi", value: 1024 ** 2 },
  { id: 5, suffix: "GB", value: 1000 ** 3 },
  { id: 6, suffix: "Gi", value: 1024 ** 3 },
  { id: 7, suffix: "TB", value: 1000 ** 4 },
  { id: 8, suffix: "Ti", value: 1024 ** 4 }
];

export const persistentStorageTypes = [
  { id: 1, className: "beta1", name: "HDD" },
  { id: 2, className: "beta2", name: "SSD" },
  { id: 3, className: "beta3", name: "NVMe" }
];

export const ephemeralStorageTypes = [...persistentStorageTypes, { id: 4, className: "ram", name: "RAM" }];
