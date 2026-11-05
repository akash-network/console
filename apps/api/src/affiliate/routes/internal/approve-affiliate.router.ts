import { container } from "tsyringe";

import { AffiliateController } from "@src/affiliate/controllers/affiliate/affiliate.controller";
import { ApproveAffiliateRequestSchema, ApproveAffiliateResponseSchema } from "@src/affiliate/http-schemas/affiliate-admin.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { requireInternalToken } from "@src/middlewares/internal-token/internal-token.middleware";

const route = createRoute({
  method: "post",
  path: "/affiliates",
  summary: "Approve a user as an affiliate, or re-approve a revoked one",
  operationId: "approveAffiliate",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: ApproveAffiliateRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "The affiliate was approved",
      content: {
        "application/json": {
          schema: ApproveAffiliateResponseSchema
        }
      }
    }
  }
});

export default new OpenApiHonoHandler().openapi(route, async function routePostApproveAffiliate(c) {
  const { data } = c.req.valid("json");
  const response = await container.resolve(AffiliateController).approve(data);

  c.header("Cache-Control", "no-store");

  return c.json(response, 201);
});
