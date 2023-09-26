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
      accept: []
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
