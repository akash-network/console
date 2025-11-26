import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { ProviderAttributesSchemaController } from "@src/provider/controllers/provider-attributes-schema/provider-attributes-schema.controller";
import { ProviderAttributesSchemaResponseSchema } from "@src/provider/http-schemas/provider-attributes-schema.schema";

const route = createRoute({
  method: "get",
  path: "/v1/provider-attributes-schema",
  summary: "Get the provider attributes schema",
  tags: ["Providers"],
  security: SECURITY_NONE,
  responses: {
    200: {
      description: "Return the provider attributes schema",
      content: {
        "application/json": {
          schema: ProviderAttributesSchemaResponseSchema
        }
      }
    }
  }
});

export const providerAttributesSchemaRouter = new OpenApiHonoHandler();

providerAttributesSchemaRouter.openapi(route, async function routeProviderAttributesSchema(c) {
  const response = await container.resolve(ProviderAttributesSchemaController).getProviderAttributesSchema();
  return c.json(response);
});
