import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { GpuWaitlistDemandController } from "@src/gpu-waitlist/controllers/gpu-waitlist-demand/gpu-waitlist-demand.controller";
import { GpuWaitlistDemandResponseSchema } from "@src/gpu-waitlist/http-schemas/gpu-waitlist.schema";
import { hideUnlessGpuWaitlistsAreServed } from "@src/gpu-waitlist/middlewares/gpu-waitlist-network-gate/gpu-waitlist-network-gate.middleware";
import { requireInternalToken } from "@src/middlewares/internal-token/internal-token.middleware";

export const internalGpuWaitlistRouter = new OpenApiHonoHandler();

internalGpuWaitlistRouter.use("/v1/gpu-waitlist/*", hideUnlessGpuWaitlistsAreServed);

const getDemandRoute = createRoute({
  method: "get",
  path: "/v1/gpu-waitlist/demand",
  operationId: "listGpuWaitlistDemand",
  summary: "How many people wait for each GPU setup, without identities",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  featureFlag: FeatureFlags.GPU_AVAILABILITY_ALERTS,
  middleware: [requireInternalToken],
  responses: {
    200: { description: "One row per waiting GPU setup, most waited for first", content: { "application/json": { schema: GpuWaitlistDemandResponseSchema } } },
    401: { description: "Missing or wrong internal token" }
  }
});

internalGpuWaitlistRouter.openapi(getDemandRoute, async function routeListGpuWaitlistDemand(c) {
  return c.json(await container.resolve(GpuWaitlistDemandController).getDemand(), 200);
});
