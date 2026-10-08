import { container } from "tsyringe";

import { RevokeAffiliateParamsSchema, RevokeAffiliateRequestSchema, RevokeAffiliateResponseSchema } from "@src/affiliate/http-schemas/affiliate-admin.schema";
import { AffiliateService } from "@src/affiliate/services/affiliate/affiliate.service";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { requireInternalToken } from "@src/middlewares/internal-token/internal-token.middleware";

const route = createRoute({
  method: "post",
  path: "/affiliates/{code}/revoke",
  summary: "Revoke an affiliate's approval",
  operationId: "revokeAffiliate",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: {
    params: RevokeAffiliateParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: RevokeAffiliateRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "The affiliate was revoked",
      content: {
        "application/json": {
          schema: RevokeAffiliateResponseSchema
        }
      }
    }
  }
});

export default new OpenApiHonoHandler().openapi(route, async function routePostRevokeAffiliate(c) {
  const { code } = c.req.valid("param");
  const { data } = c.req.valid("json");
  const affiliate = await container.resolve(AffiliateService).revoke({ code, actor: data.actor });

  c.header("Cache-Control", "no-store");

  return c.json({ data: { id: affiliate.id, code: affiliate.code, revokedAt: affiliate.revokedAt! } }, 200);
});
