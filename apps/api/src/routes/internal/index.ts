import { leasesDurationInternalRouter } from "@src/dashboard";
import { getGpuPricesInternalRouter, listGpuModelsInternalRouter, listGpusInternalRouter } from "@src/gpu";
import { providerEarningsRouter } from "@src/provider/routes/provider-earnings/provider-earnings.router";
import financial from "./financial";

export default [
  listGpusInternalRouter,
  listGpuModelsInternalRouter,
  leasesDurationInternalRouter,
  getGpuPricesInternalRouter,
  providerEarningsRouter,
  financial
];
