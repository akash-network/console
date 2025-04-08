import type { ControlMachineWithAddress } from "@src/types/controlMachine";
import { processKeyfile } from "./nodeVerification";

export function sanitizeMachineAccess(machine: ControlMachineWithAddress | null) {
  if (!machine) {
    return undefined;
  }
  return {
    hostname: machine.access.hostname,
    port: machine.access.port,
    username: machine.access.username,
    keyfile: machine.access.keyfile ? processKeyfile(machine.access.keyfile) : null,
    password: machine.access.password || null,
    passphrase: machine.access.passphrase || null
  };
}

export function convertFromPricingAPI(pricing: any) {
  return {
    cpu: pricing.price_target_cpu,
    memory: pricing.price_target_memory,
    storage: pricing.price_target_hd_ephemeral,
    persistentStorage: pricing.price_target_hd_pers_ssd,
    gpu: Number(pricing.price_target_gpu_mappings.split("=")[1]),
    ipScalePrice: pricing.price_target_ip,
    endpointBidPrice: pricing.price_target_endpoint
  };
}
