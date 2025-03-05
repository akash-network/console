import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
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
          schema: z.object({
            data: z.object({
              success: z.boolean()
            })
          })
        }
      }
    }
  }
});

export const leasesRouter = new OpenApiHonoHandler();

leasesRouter.openapi(createLeaseRoute, async function routeCreateLease(c) {
  const input = c.req.valid("json");
  const result = await container.resolve(DeploymentController).createLeasesAndSendManifest(input.leases[0].dseq, input);
  return c.json(result, 200);
});
