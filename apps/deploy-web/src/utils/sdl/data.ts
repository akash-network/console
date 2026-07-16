import { nanoid } from "nanoid";

import { UACT_DENOM } from "@src/config/denom.config";
import type { EndpointType, ExposeType, PlacementType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { SSH_VM_IMAGES, sshVmDistros, sshVmImages } from "./vmImages";

export { SSH_VM_IMAGES, sshVmDistros, sshVmImages };

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

/**
 * Builds a fresh placement with a generated id and the dcloud defaults.
 */
export const defaultPlacement = (overrides?: Partial<PlacementType>): PlacementType => ({
  id: nanoid(),
  name: "dcloud",
  signedBy: {
    anyOf: [],
    allOf: []
  },
  attributes: [],
  ...overrides
});

/** Builds a fresh IP endpoint with a generated id and the default name "endpoint-1"; callers pass a unique name via overrides. */
export const defaultEndpoint = (overrides?: Partial<EndpointType>): EndpointType => ({
  id: nanoid(),
  name: "endpoint-1",
  ...overrides
});

/**
 * Builds a fresh service bound to the given placement id and seeded with the
 * standard single-port HTTP expose / compute / pricing defaults.
 */
export const defaultService = (placementId: string, overrides?: Partial<ServiceType>): ServiceType => ({
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
        nextCases: [...defaultHttpOptions.nextCases],
        nextTries: defaultHttpOptions.nextTries,
        nextTimeout: defaultHttpOptions.nextTimeout
      }
    }
  ],
  command: { command: "", arg: "" },
  env: [],
  placementId,
  pricing: {
    amount: 100000,
    denom: UACT_DENOM
  },
  count: 1,
  ...overrides
});

/**
 * Builds top-level form values for a brand-new deployment: one placement
 * paired with one service that references it. Use this anywhere the form
 * is initialized from scratch.
 */
export const defaultServiceWithPlacement = (serviceOverrides?: Partial<ServiceType>): SdlBuilderFormValuesType => {
  const placement = defaultPlacement();
  return {
    placements: [placement],
    services: [defaultService(placement.id, serviceOverrides)],
    endpoints: []
  };
};

export const defaultPersistentStorage = {
  size: 10,
  unit: "Gi",
  isPersistent: true,
  type: "beta3",
  name: "data",
  mount: "/mnt/data",
  isReadOnly: false
};

export const defaultRamStorage = {
  size: 10,
  unit: "Gi",
  isPersistent: false,
  type: "ram",
  name: "shm",
  mount: "/dev/shm",
  isReadOnly: false
};

/** The defaults applied to a freshly added GPU collection (vendor preset, model left for the user to pick). */
export const defaultGpuModel = { vendor: "nvidia", name: "", memory: "", interface: "" };

export const SSH_EXPOSE = {
  port: 22,
  as: 22,
  global: true,
  to: []
};

/**
 * Overrides applied to a fresh service when the surrounding flow exposes SSH:
 * picks a known SSH-enabled VM image and drops the default HTTP expose.
 */
export const sshServiceOverrides: Partial<ServiceType> = {
  image: sshVmDistros[0],
  expose: []
};

/**
 * The managed SSH expose row a fresh Container-VM service is seeded with: container port 22 published
 * globally as 22 over tcp. The configure flow generates the SDL straight from form state (no
 * `transformCustomSdlFields` pass), so the row must exist on the model itself.
 */
export const vmSshExpose = (): ExposeType => ({
  id: nanoid(),
  port: 22,
  as: 22,
  proto: "tcp",
  global: true,
  to: [],
  accept: [],
  ipName: ""
});

/**
 * Overrides for a fresh Container-VM service on the configure screen: the real distro image ref
 * (unlike the legacy `sshServiceOverrides`, which stores a display label mapped at generation time),
 * the managed SSH expose, and the single instance VMs run as.
 */
export const vmServiceOverrides = (): Partial<ServiceType> => ({
  image: SSH_VM_IMAGES["Ubuntu 24.04"],
  expose: [vmSshExpose()],
  count: 1
});

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
