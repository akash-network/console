import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER } from "@src/core/services/openapi-docs/openapi-security";
import { hideUnlessGpuWaitlistsAreServed } from "@src/gpu-waitlist/middlewares/gpu-waitlist-network-gate/gpu-waitlist-network-gate.middleware";
import { GpuWaitlistController } from "../controllers/gpu-waitlist/gpu-waitlist.controller";
import {
  GpuWaitlistEntryIdParamsSchema,
  GpuWaitlistEntryResponseSchema,
  JoinGpuWaitlistRequestSchema,
  ListGpuWaitlistResponseSchema
} from "../http-schemas/gpu-waitlist.schema";

export const gpuWaitlistRouter = new OpenApiHonoHandler();

gpuWaitlistRouter.use("/v1/gpu-waitlist/*", hideUnlessGpuWaitlistsAreServed);

const joinGpuWaitlistRoute = createRoute({
  method: "post",
  operationId: "joinGpuWaitlist",
  path: "/v1/gpu-waitlist",
  summary: "Wait for a GPU setup that has no bids right now",
  description: "Joining the same setup again updates the GPU count and keeps the place in line. Waiting does not hold capacity: the first to deploy gets it.",
  tags: ["GPU waitlist"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.GPU_AVAILABILITY_ALERTS,
  request: { body: { required: true, content: { "application/json": { schema: JoinGpuWaitlistRequestSchema } } } },
  responses: {
    200: { description: "The waitlist entry with its place in line", content: { "application/json": { schema: GpuWaitlistEntryResponseSchema } } },
    400: { description: "Invalid request body" },
    401: { description: "Unauthorized" },
    409: { description: "The user is already waiting for the maximum number of GPU setups" },
    429: { description: "Too many waitlists joined recently" }
  }
});

gpuWaitlistRouter.openapi(joinGpuWaitlistRoute, async function routeJoinGpuWaitlist(c) {
  const { data } = c.req.valid("json");
  return c.json(await container.resolve(GpuWaitlistController).join(data), 200);
});

const listGpuWaitlistRoute = createRoute({
  method: "get",
  operationId: "listGpuWaitlist",
  path: "/v1/gpu-waitlist",
  summary: "List the GPU setups the caller is waiting for, newest first",
  tags: ["GPU waitlist"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.GPU_AVAILABILITY_ALERTS,
  responses: {
    200: { description: "The caller's waiting entries", content: { "application/json": { schema: ListGpuWaitlistResponseSchema } } },
    401: { description: "Unauthorized" }
  }
});

gpuWaitlistRouter.openapi(listGpuWaitlistRoute, async function routeListGpuWaitlist(c) {
  return c.json(await container.resolve(GpuWaitlistController).list(), 200);
});

const leaveGpuWaitlistRoute = createRoute({
  method: "delete",
  operationId: "leaveGpuWaitlist",
  path: "/v1/gpu-waitlist/{id}",
  summary: "Stop waiting for a GPU setup",
  tags: ["GPU waitlist"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.GPU_AVAILABILITY_ALERTS,
  request: { params: GpuWaitlistEntryIdParamsSchema },
  responses: {
    204: { description: "The caller left the waitlist" },
    401: { description: "Unauthorized" },
    404: { description: "The caller is not waiting with this id" }
  }
});

gpuWaitlistRouter.openapi(leaveGpuWaitlistRoute, async function routeLeaveGpuWaitlist(c) {
  await container.resolve(GpuWaitlistController).leave(c.req.valid("param").id);
  return c.body(null, 204);
});

const keepGpuWaitlistEntryRoute = createRoute({
  method: "post",
  operationId: "keepGpuWaitlistEntry",
  path: "/v1/gpu-waitlist/{id}/keep",
  summary: "Keep waiting for a GPU setup after being asked if it is still wanted",
  tags: ["GPU waitlist"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.GPU_AVAILABILITY_ALERTS,
  request: { params: GpuWaitlistEntryIdParamsSchema },
  responses: {
    200: { description: "The waitlist entry with its place in line", content: { "application/json": { schema: GpuWaitlistEntryResponseSchema } } },
    401: { description: "Unauthorized" },
    404: { description: "The caller is not waiting with this id" }
  }
});

gpuWaitlistRouter.openapi(keepGpuWaitlistEntryRoute, async function routeKeepGpuWaitlistEntry(c) {
  return c.json(await container.resolve(GpuWaitlistController).keep(c.req.valid("param").id), 200);
});
