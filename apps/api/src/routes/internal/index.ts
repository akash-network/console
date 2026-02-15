import { adminReviewRouter } from "@src/billing/routes";
import { leasesDurationInternalRouter } from "@src/dashboard";
import { getGpuPricesInternalRouter, listGpuModelsInternalRouter, listGpusInternalRouter } from "@src/gpu";
import financial from "./financial";

export default [listGpusInternalRouter, listGpuModelsInternalRouter, leasesDurationInternalRouter, getGpuPricesInternalRouter, financial, adminReviewRouter];
