import { internalActivityRouter } from "@src/activity";
import { approveAffiliateRouter, revokeAffiliateRouter } from "@src/affiliate";
import type { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { leasesDurationInternalRouter } from "@src/dashboard";
import { internalDeploymentNameRouter } from "@src/deployment/routes/deployment-name/internal-deployment-name.router";
import { getGpuPricesInternalRouter, listGpuModelsInternalRouter, listGpusInternalRouter } from "@src/gpu";
import { internalHardwareRequestRouter } from "@src/hardware-request/routes/internal-hardware-request.router";
import { internalAccountStatusRouter } from "@src/user/routes/internal-account-status/internal-account-status.router";
import emailDomainCheck from "./email-domain-check";
import financial from "./financial";

export const internalOpenApiHonoHandlers: OpenApiHonoHandler[] = [
  emailDomainCheck,
  internalActivityRouter,
  internalDeploymentNameRouter,
  internalHardwareRequestRouter,
  internalAccountStatusRouter,
  approveAffiliateRouter,
  revokeAffiliateRouter
];

export default [listGpusInternalRouter, listGpuModelsInternalRouter, leasesDurationInternalRouter, getGpuPricesInternalRouter, financial];
