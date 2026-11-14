import { container } from "tsyringe";

import { AffiliateController } from "@src/affiliate/controllers/affiliate/affiliate.controller";
import { AffiliateProfileResponseSchema } from "@src/affiliate/http-schemas/affiliate-profile.schema";
import { ListAffiliateReferralsQuerySchema, ListAffiliateReferralsResponseSchema } from "@src/affiliate/http-schemas/affiliate-referral.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const affiliateProfileRouter = new OpenApiHonoHandler();

const getAffiliateProfileRoute = createRoute({
  method: "get",
  path: "/v1/affiliates/me",
  summary: "Get the caller's affiliate profile",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "getAffiliateProfile",
  tags: ["Affiliates"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {},
  responses: {
    200: {
      description: "The caller's affiliate profile, or null when they are not an approved affiliate",
      content: {
        "application/json": {
          schema: AffiliateProfileResponseSchema
        }
      }
    },
    401: { description: "Unauthorized" }
  }
});

affiliateProfileRouter.openapi(getAffiliateProfileRoute, async function routeGetAffiliateProfile(c) {
  return c.json(await container.resolve(AffiliateController).getProfile(), 200);
});

const listAffiliateReferralsRoute = createRoute({
  method: "get",
  path: "/v1/affiliates/me/referrals",
  summary: "List the people the caller referred",
  operationId: "listAffiliateReferrals",
  tags: ["Affiliates"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: { query: ListAffiliateReferralsQuerySchema },
  responses: {
    200: {
      description: "The caller's referrals, newest first, shown by a short code only",
      content: {
        "application/json": {
          schema: ListAffiliateReferralsResponseSchema
        }
      }
    },
    401: { description: "Unauthorized" },
    404: { description: "The caller is not an approved affiliate" }
  }
});

affiliateProfileRouter.openapi(listAffiliateReferralsRoute, async function routeListAffiliateReferrals(c) {
  return c.json(await container.resolve(AffiliateController).listReferrals(c.req.valid("query")), 200);
});
