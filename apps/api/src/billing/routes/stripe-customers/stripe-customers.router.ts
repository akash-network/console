import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import { UpdateCustomerOrganizationRequestSchema } from "@src/billing/http-schemas/stripe.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const updateCustomerOrganizationRoute = createRoute({
  method: "put",
  path: "/v1/stripe/customers/organization",
  summary: "Update customer organization",
  description: "Updates the organization/business name for the current user's Stripe customer account",
  tags: ["Payment"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdateCustomerOrganizationRequestSchema
        }
      }
    }
  },
  responses: {
    204: {
      description: "Organization updated successfully"
    }
  }
});

export const stripeCustomersRouter = new OpenApiHonoHandler();

stripeCustomersRouter.openapi(updateCustomerOrganizationRoute, async function updateCustomerOrganization(c) {
  const data = c.req.valid("json");
  await container.resolve(StripeController).updateCustomerOrganization(data);
  return c.body(null, 204);
});
