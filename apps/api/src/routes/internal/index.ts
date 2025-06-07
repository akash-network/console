import { leasesDurationInternalRouter } from "@src/dashboard";
import gpu from "../v1/gpu";
import gpuModels from "../v1/gpuModels";
import gpuPrices from "../v1/gpuPrices";
import financial from "./financial";

export default [gpu, leasesDurationInternalRouter, gpuModels, gpuPrices, financial];
