import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const StripePricesOutputSchema = z.object({
  currency: z.string().openapi({}),
  unitAmount: z.number().openapi({}),
  isCustom: z.boolean().openapi({})
});

export const StripePricesResponseOutputSchema = z.object({
  data: z.array(StripePricesOutputSchema)
});

export type StripePricesOutputResponse = z.infer<typeof StripePricesResponseOutputSchema>;

const route = createRoute({
  method: "get",
  path: "/v1/stripe-prices",
  summary: "",
  request: {},
  responses: {
    200: {
      description: "",
      content: {
        "application/json": {
          schema: StripePricesResponseOutputSchema
        }
      }
    }
  }
});

export const stripePricesRouter = new OpenApiHonoHandler();

stripePricesRouter.openapi(route, async function routeStripePrices(c) {
  await container.resolve(StripeController).findPrices();
  return c.json(await container.resolve(StripeController).findPrices(), 200);
});
