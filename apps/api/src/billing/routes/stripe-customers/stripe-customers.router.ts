import { container } from "tsyringe";

import { StripeController } from "@src/billing/controllers/stripe/stripe.controller";
import { UpdateCustomerOrganizationRequestSchema } from "@src/billing/http-schemas/stripe.schema";
import { createRoute } from "@src/core/services/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const stripeCustomersRouter = new OpenApiHonoHandler();

const updateCustomerOrganizationRoute = createRoute({
  method: "put",
  path: "/v1/stripe/customers/organization",
  summary: "Update customer organization",
  description: "Updates the organization/business name for the current user's Stripe customer account",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
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
stripeCustomersRouter.openapi(updateCustomerOrganizationRoute, async function updateCustomerOrganization(c) {
  const data = c.req.valid("json");
  await container.resolve(StripeController).updateCustomerOrganization(data);
  return c.body(null, 204);
});
