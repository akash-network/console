// https://github.com/akash-network/akash-api/blob/ea71fbd0bee740198034bf1b0261c90baea88be0/go/node/deployment/v1beta3/validation_config.go
export const validationConfig = {
  maxCpuAmount: 256,
  maxGroupCpuCount: 512,
  maxGpuAmount: 100,
  maxGroupGpuCount: 512,
  minMemory: 1024, // 1 Mi
  minStorage: 5 * 1024, // 5 Mi
  maxMemory: 512 * 1024 ** 3, // 512 Gi
  maxGroupMemory: 1024 * 1024 ** 3, // 1024 Gi
  maxStorage: 32 * 1024 ** 4 // 32 Ti
};

export const memoryUnits = [
  { id: 3, suffix: "Mb", value: 1000 ** 2 },
  { id: 4, suffix: "Mi", value: 1024 ** 2 },
  { id: 5, suffix: "GB", value: 1000 ** 3 },
  { id: 6, suffix: "Gi", value: 1024 ** 3 }
];

export const storageUnits = [
  { id: 3, suffix: "Mb", value: 1000 ** 2 },
  { id: 4, suffix: "Mi", value: 1024 ** 2 },
  { id: 5, suffix: "GB", value: 1000 ** 3 },
  { id: 6, suffix: "Gi", value: 1024 ** 3 },
  { id: 7, suffix: "TB", value: 1000 ** 4 },
  { id: 8, suffix: "Ti", value: 1024 ** 4 }
];

export const persistentStorageTypes = [
  { id: 1, className: "beta1", name: "hdd" },
  { id: 2, className: "beta2", name: "ssd" },
  { id: 3, className: "beta3", name: "NVMe" }
];
