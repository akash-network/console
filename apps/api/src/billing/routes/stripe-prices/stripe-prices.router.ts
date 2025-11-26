import { container } from "tsyringe";
import { z } from "zod";

import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import { createRoute } from "@src/core/services/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

const StripePricesOutputSchema = z.object({
  currency: z.string().openapi({}),
  unitAmount: z.number().openapi({}),
  isCustom: z.boolean().openapi({})
});

export const StripePricesResponseOutputSchema = z.object({
  data: z.array(StripePricesOutputSchema)
});

export type StripePricesOutputResponse = z.infer<typeof StripePricesResponseOutputSchema>;

export const stripePricesRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/stripe/prices",
  summary: "Get available Stripe pricing options",
  description: "Retrieves the list of available pricing options for wallet top-ups, including custom amounts and standard pricing tiers",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {},
  responses: {
    200: {
      description: "Available pricing options retrieved successfully",
      content: {
        "application/json": {
          schema: StripePricesResponseOutputSchema
        }
      }
    }
  }
});
stripePricesRouter.openapi(route, async function routeStripePrices(c) {
  await container.resolve(StripeController).findPrices();
  return c.json(await container.resolve(StripeController).findPrices(), 200);
});
