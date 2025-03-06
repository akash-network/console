import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { LeaseController } from "@src/deployment/controllers/lease/lease.controller";
import { GetDeploymentResponseSchema } from "@src/deployment/http-schemas/deployment.schema";
import { CreateLeaseRequestSchema } from "@src/deployment/http-schemas/lease.schema";

const createLeaseRoute = createRoute({
  method: "post",
  path: "/v1/leases",
  summary: "Create leases and send manifest",
  tags: ["Leases"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateLeaseRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Leases created and manifest sent",
      content: {
        "application/json": {
          schema: GetDeploymentResponseSchema
        }
      }
    }
  }
});

export const leasesRouter = new OpenApiHonoHandler();

leasesRouter.openapi(createLeaseRoute, async function routeCreateLease(c) {
  const input = c.req.valid("json");
  const result = await container.resolve(LeaseController).createLeasesAndSendManifest(input);
  return c.json(result, 200);
});
