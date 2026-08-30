import { leasesDurationInternalRouter } from "@src/dashboard";
import { getGpuPricesInternalRouter, listGpuModelsInternalRouter, listGpusInternalRouter } from "@src/gpu";
import financial from "./financial";
import providerVerificationTierDemotions from "./providerVerificationTierDemotions";

export default [
  listGpusInternalRouter,
  listGpuModelsInternalRouter,
  leasesDurationInternalRouter,
  getGpuPricesInternalRouter,
  financial,
  providerVerificationTierDemotions
];
