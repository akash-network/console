import { z } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY, SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { LeaseController } from "@src/deployment/controllers/lease/lease.controller";
import { CreateLeaseResponseSchema } from "@src/deployment/http-schemas/deployment.schema";
import { CreateLeaseRequestSchema } from "@src/deployment/http-schemas/lease.schema";
import { FallbackLeaseListQuerySchema, FallbackLeaseListResponseSchema } from "@src/deployment/http-schemas/lease-rpc.schema";

export const leasesRouter = new OpenApiHonoHandler();

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  code: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()).optional()
});

const createLeaseRoute = createRoute({
  method: "post",
  path: "/v1/leases",
  summary: "Create leases and send manifest",
  operationId: "createLease",
  tags: ["Leases"],
  security: SECURITY_BEARER_OR_API_KEY,
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
          schema: CreateLeaseResponseSchema
        }
      }
    },
    502: {
      description:
        "A provider could not be reached. `provider_unreachable`: no lease was created, choose another bid. `manifest_not_delivered`: the lease exists but its provider did not receive the manifest; send the same request again to retry, or close the deployment",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});
leasesRouter.openapi(createLeaseRoute, async function routeCreateLease(c) {
  const input = c.req.valid("json");
  const result = await container.resolve(LeaseController).createLeasesAndSendManifest(input);
  return c.json(result, 200);
});

const fallbackListRoute = createRoute({
  method: "get",
  path: "/akash/market/{version}/leases/list",
  summary: "List leases (database fallback)",
  tags: ["Leases"],
  security: SECURITY_NONE,
  request: {
    query: FallbackLeaseListQuerySchema
  },
  responses: {
    200: {
      description: "Returns paginated list of leases from database",
      content: {
        "application/json": {
          schema: FallbackLeaseListResponseSchema
        }
      }
    }
  }
});
leasesRouter.openapi(fallbackListRoute, async function routeFallbackListLeases(c) {
  const query = c.req.valid("query");
  const result = await container.resolve(LeaseController).listLeasesFallback({
    owner: query["filters.owner"],
    dseq: query["filters.dseq"],
    gseq: query["filters.gseq"],
    oseq: query["filters.oseq"],
    provider: query["filters.provider"],
    state: query["filters.state"],
    skip: query["pagination.offset"],
    limit: query["pagination.limit"],
    key: query["pagination.key"],
    countTotal: query["pagination.count_total"],
    reverse: query["pagination.reverse"]
  });
  return c.json(result, 200);
});
