import { Service } from "@src/types";
import { nanoid } from "nanoid";

export const protoTypes = [
  { id: 1, name: "http" },
  // { id: 2, name: "https" },
  { id: 3, name: "tcp" }
];

export const defaultService: Service = {
  id: nanoid(),
  title: "service-1",
  image: "",
  profile: {
    cpu: 0.1,
    gpu: 1,
    gpuVendor: "nvidia",
    gpuModels: [],
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
        maxBodySize: 3145728,
        readTimeout: 50000,
        sendTimeout: 51000,
        nextCases: ["error", "500"],
        nextTries: 2,
        nextTimeout: 50000
      }
    }
  ],
  command: { command: "", arg: "" },
  env: [],
  placement: {
    name: "dcloud",
    pricing: {
      amount: 1000
    },
    signedBy: {
      anyOf: [],
      allOf: []
    },
    attributes: []
  },
  count: 1
};

export const nextCases = [
  { id: 1, value: "error" },
  { id: 2, value: "timeout" },
  { id: 3, value: "403" },
  { id: 4, value: "404" },
  { id: 5, value: "429" },
  { id: 6, value: "500" },
  { id: 7, value: "502" },
  { id: 8, value: "503" },
  { id: 9, value: "504" },
  { id: 10, value: "off" }
];
