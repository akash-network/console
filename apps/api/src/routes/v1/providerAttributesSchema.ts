import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getProviderAttributesSchema } from "@src/services/external/githubService";

const attributeSchemaType = z.object({
  key: z.string(),
  type: z.enum(["string", "number", "boolean", "option", "multiple-option"]),
  required: z.boolean(),
  description: z.string(),
  values: z
    .array(
      z.object({
        key: z.string(),
        description: z.string(),
        value: z.any().nullable()
      })
    )
    .nullable()
});

const route = createRoute({
  method: "get",
  path: "/provider-attributes-schema",
  summary: "Get the provider attributes schema",
  tags: ["Providers"],
  responses: {
    200: {
      description: "Return the provider attributes schema",
      content: {
        "application/json": {
          schema: z.object({
            host: attributeSchemaType,
            email: attributeSchemaType,
            organization: attributeSchemaType,
            website: attributeSchemaType,
            tier: attributeSchemaType,
            "status-page": attributeSchemaType,
            "location-region": attributeSchemaType,
            country: attributeSchemaType,
            city: attributeSchemaType,
            timezone: attributeSchemaType,
            "location-type": attributeSchemaType,
            "hosting-provider": attributeSchemaType,
            "hardware-cpu": attributeSchemaType,
            "hardware-cpu-arch": attributeSchemaType,
            "hardware-gpu": attributeSchemaType,
            "hardware-gpu-model": attributeSchemaType,
            "hardware-disk": attributeSchemaType,
            "hardware-memory": attributeSchemaType,
            "network-provider": attributeSchemaType,
            "network-speed-up": attributeSchemaType,
            "network-speed-down": attributeSchemaType,
            "feat-persistent-storage": attributeSchemaType,
            "feat-persistent-storage-type": attributeSchemaType,
            "workload-support-chia": attributeSchemaType,
            "workload-support-chia-capabilities": attributeSchemaType,
            "feat-endpoint-ip": attributeSchemaType,
            "feat-endpoint-custom-domain": attributeSchemaType
          })
        }
      }
    },
    400: {
      description: "Invalid address"
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const providerAttributesSchema = await getProviderAttributesSchema();
  return c.json(providerAttributesSchema);
});
