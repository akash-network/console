import { container } from "tsyringe";

import { BillingDetailsController } from "@src/billing/controllers/billing-details/billing-details.controller";
import { BillingDetailsResponseSchema, UpdateBillingDetailsRequestSchema } from "@src/billing/http-schemas/billing-details.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const billingDetailsRouter = new OpenApiHonoHandler();

const getBillingDetailsRoute = createRoute({
  method: "get",
  path: "/v1/billing-details",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "getBillingDetails",
  summary: "Get billing details",
  description: "Returns the legal name, billing address and tax ID printed on the invoices of the active account or organization",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  responses: {
    200: { description: "The billing details, empty until they are first set", content: { "application/json": { schema: BillingDetailsResponseSchema } } },
    401: { description: "Unauthorized" },
    403: { description: "The caller cannot read the billing of this organization" }
  }
});

billingDetailsRouter.openapi(getBillingDetailsRoute, async function routeGetBillingDetails(c) {
  return c.json(await container.resolve(BillingDetailsController).getBillingDetails(), 200);
});

const updateBillingDetailsRoute = createRoute({
  method: "put",
  path: "/v1/billing-details",
  operationId: "updateBillingDetails",
  summary: "Set billing details",
  description: "Replaces the legal name, billing address and tax ID printed on the invoices of the active account or organization",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: { required: true, content: { "application/json": { schema: UpdateBillingDetailsRequestSchema } } }
  },
  responses: {
    200: { description: "The saved billing details", content: { "application/json": { schema: BillingDetailsResponseSchema } } },
    400: { description: "A field is missing or malformed, or the tax ID is not valid for its type" },
    401: { description: "Unauthorized" },
    403: { description: "The caller cannot manage the billing of this organization" }
  }
});

billingDetailsRouter.openapi(updateBillingDetailsRoute, async function routeUpdateBillingDetails(c) {
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(BillingDetailsController).updateBillingDetails({ data }), 200);
});
