import { container } from "tsyringe";

import { ReferralController } from "@src/affiliate/controllers/referral/referral.controller";
import { GetReferralCodeParamsSchema, GetReferralCodeResponseSchema, ReferralResponseSchema } from "@src/affiliate/http-schemas/referral.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY, SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

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

const getReferralCodeRoute = createRoute({
  method: "get",
  path: "/v1/referral-codes/{code}",
  summary: "Check whether a referral code grants the referral trial credits",
  operationId: "getReferralCode",
  tags: ["Affiliates"],
  security: SECURITY_NONE,
  cache: { maxAge: 60 },
  request: {
    params: GetReferralCodeParamsSchema
  },
  responses: {
    200: {
      description: "Whether the code is valid, with the trial credits a new account signing up with it gets",
      content: {
        "application/json": {
          schema: GetReferralCodeResponseSchema
        }
      }
    }
  }
});

referralRouter.openapi(getReferralCodeRoute, async function routeGetReferralCode(c) {
  const { code } = c.req.valid("param");
  return c.json(await container.resolve(ReferralController).checkCode(code), 200);
});
