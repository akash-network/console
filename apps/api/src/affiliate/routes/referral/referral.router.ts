import { container } from "tsyringe";

import { ReferralController } from "@src/affiliate/controllers/referral/referral.controller";
import { ReferralResponseSchema } from "@src/affiliate/http-schemas/referral.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const referralRouter = new OpenApiHonoHandler();

const getReferralRoute = createRoute({
  method: "get",
  path: "/v1/referral",
  summary: "Get the caller's referral trial credits",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "getReferral",
  tags: ["Affiliates"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {},
  responses: {
    200: {
      description: "The caller's referral trial credits, or null when they were not referred",
      content: {
        "application/json": {
          schema: ReferralResponseSchema
        }
      }
    },
    401: { description: "Unauthorized" }
  }
});

referralRouter.openapi(getReferralRoute, async function routeGetReferral(c) {
  return c.json(await container.resolve(ReferralController).getReferral(), 200);
});
