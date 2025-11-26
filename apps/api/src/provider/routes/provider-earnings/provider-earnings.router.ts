import type { Context } from "hono";
import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { ProviderEarningsController } from "@src/provider/controllers/provider-earnings/provider-earnings.controller";
import { ProviderEarningsParamsSchema, ProviderEarningsQuerySchema, ProviderEarningsResponseSchema } from "@src/provider/http-schemas/provider-earnings.schema";

const providerEarningsRoute = createRoute({
  method: "get",
  path: "/v1/provider-earnings/{owner}",
  summary: "Get earnings data for provider console.",
  tags: ["Providers"],
  security: SECURITY_NONE,
  request: {
    params: ProviderEarningsParamsSchema,
    query: ProviderEarningsQuerySchema
  },
  responses: {
    200: {
      description: "Earnings data",
      content: {
        "application/json": {
          schema: ProviderEarningsResponseSchema
        }
      }
    },
    404: {
      description: "Provider not found"
    }
  }
});

export const providerEarningsRouter = new OpenApiHonoHandler();

providerEarningsRouter.openapi(providerEarningsRoute, async function routeProviderEarnings(c: Context) {
  const owner = c.req.param("owner");
  const { from, to } = c.req.query();

  const response = await container.resolve(ProviderEarningsController).getProviderEarnings(owner, {
    from: new Date(from),
    to: new Date(to)
  });
  return c.json(response);
});
