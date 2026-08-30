import { OpenAPIHono, z } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { ProviderVerificationTierDemotionFeedSchema } from "@src/provider/provider-verification/provider-verification-tier-demotion.schema";
import { ProviderVerificationTierDemotionService } from "@src/provider/provider-verification/provider-verification-tier-demotion.service";

const route = createRoute({
  method: "get",
  path: "/v1/provider-verification/tier-demotions",
  summary: "Read provider verification tier demotions",
  security: SECURITY_NONE,
  request: {
    query: z.object({
      after: z.string().regex(/^\d+$/).default("0"),
      limit: z.number({ coerce: true }).int().min(1).max(100).default(100)
    })
  },
  responses: {
    200: {
      description: "Ordered provider tier demotions",
      content: { "application/json": { schema: ProviderVerificationTierDemotionFeedSchema } }
    },
    503: {
      description: "Provider verification state is not caught up",
      content: { "application/json": { schema: z.object({ error: z.literal("provider_verification_not_ready") }) } }
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const { after, limit } = c.req.valid("query");
  const feed = await container.resolve(ProviderVerificationTierDemotionService).getFeed(after, limit);
  return feed ? c.json(feed, 200) : c.json({ error: "provider_verification_not_ready" as const }, 503);
});
