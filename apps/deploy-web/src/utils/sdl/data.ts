import { nanoid } from "nanoid";

import { ProviderRegionValueType, ServiceType } from "@src/types";

export const protoTypes = [
  { id: 1, name: "http" },
  // { id: 2, name: "https" },
  { id: 3, name: "tcp" }
];

export const defaultHttpOptions = {
  maxBodySize: 1048576,
  readTimeout: 60000,
  sendTimeout: 60000,
  nextCases: ["error", "timeout"],
  nextTries: 3,
  nextTimeout: 60000
};

export const defaultService: ServiceType = {
  id: nanoid(),
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
    storage: 1,
    storageUnit: "Gi",
    hasPersistentStorage: false,
    persistentStorage: 10,
    persistentStorageUnit: "Gi",
    persistentStorageParam: {
      name: "data",
      type: "beta2",
      mount: ""
    }
  },
  expose: [
    {
      id: nanoid(),
      port: 80,
      as: 80,
      proto: "http",
      global: true,
      to: [],
      accept: [],
      ipName: "",
      httpOptions: {
        maxBodySize: defaultHttpOptions.maxBodySize,
        readTimeout: defaultHttpOptions.readTimeout,
        sendTimeout: defaultHttpOptions.sendTimeout,
        nextCases: defaultHttpOptions.nextCases,
        nextTries: defaultHttpOptions.nextTries,
        nextTimeout: defaultHttpOptions.nextTimeout
      }
    }
  ],
  command: { command: "", arg: "" },
  env: [],
  placement: {
    name: "dcloud",
    pricing: {
      amount: 1000,
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

export const SSH_VM_IMAGES = {
  "Ubuntu 24.04": "ghcr.io/akash-network/ubuntu-2404-ssh:1",
  "CentOS Stream 9": "ghcr.io/akash-network/centos-stream9-ssh:1",
  "Debian 11": "ghcr.io/akash-network/debian-11-ssh:1",
  "SuSE Leap 15.5": "ghcr.io/akash-network/opensuse-leap-155-ssh:1"
};
export const sshVmDistros: string[] = Object.keys(SSH_VM_IMAGES);
export const sshVmImages: Set<string> = new Set(Object.values(SSH_VM_IMAGES));
export const SSH_EXPOSE = {
  port: 22,
  as: 22,
  global: true,
  to: []
};

export const defaultSshVMService: ServiceType = {
  ...defaultService,
  expose: []
};

export const defaultRentGpuService: ServiceType = {
  id: nanoid(),
  title: "service-1",
  image: "",
  profile: {
    cpu: 0.1,
    gpu: 1,
    gpuModels: [{ vendor: "nvidia" }],
    hasGpu: true,
    ram: 512,
    ramUnit: "Mi",
    storage: 1,
    storageUnit: "Gi",
    hasPersistentStorage: false,
    persistentStorage: 10,
    persistentStorageUnit: "Gi",
    persistentStorageParam: {
      name: "data",
      type: "beta2",
      mount: ""
    }
  },
  expose: [
    {
      id: nanoid(),
      port: 80,
      as: 80,
      proto: "http",
      global: true,
      to: [],
      accept: [],
      ipName: "",
      httpOptions: {
        maxBodySize: defaultHttpOptions.maxBodySize,
        readTimeout: defaultHttpOptions.readTimeout,
        sendTimeout: defaultHttpOptions.sendTimeout,
        nextCases: defaultHttpOptions.nextCases,
        nextTries: defaultHttpOptions.nextTries,
        nextTimeout: defaultHttpOptions.nextTimeout
      }
    }
  ],
  command: { command: "", arg: "" },
  env: [],
  placement: {
    name: "dcloud",
    pricing: {
      amount: 1000,
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

export const defaultAnyRegion: ProviderRegionValueType = {
  key: "any",
  value: "any",
  description: "Any region"
};

export const nextCases = [
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
