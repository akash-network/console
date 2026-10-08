import { approveAffiliateRouter, revokeAffiliateRouter } from "@src/affiliate";
import type { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { leasesDurationInternalRouter } from "@src/dashboard";
import { getGpuPricesInternalRouter, listGpuModelsInternalRouter, listGpusInternalRouter } from "@src/gpu";
import emailDomainCheck from "./email-domain-check";
import financial from "./financial";

export const internalOpenApiHonoHandlers: OpenApiHonoHandler[] = [emailDomainCheck, approveAffiliateRouter, revokeAffiliateRouter];

export default [listGpusInternalRouter, listGpuModelsInternalRouter, leasesDurationInternalRouter, getGpuPricesInternalRouter, financial];
