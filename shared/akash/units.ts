export const minMemory = 1024; // 1 Mi
export const minStorage = 5 * 1024; // 5 Mi
export const maxMemory = 512 * 1024 ** 3; // 512 Gi
export const maxGroupMemory = 1024 * 1024 ** 3; // 1024 Gi
export const maxStorage = 32 * 1024 ** 4; // 32 Ti

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
