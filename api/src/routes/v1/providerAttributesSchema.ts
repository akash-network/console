import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getProviderAttributesSchema } from "@src/providers/githubProvider";

const attributeSChemaType = z.object({
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
            host: attributeSChemaType,
            email: attributeSChemaType,
            organization: attributeSChemaType,
            website: attributeSChemaType,
            tier: attributeSChemaType,
            "status-page": attributeSChemaType,
            "location-region": attributeSChemaType,
            country: attributeSChemaType,
            city: attributeSChemaType,
            timezone: attributeSChemaType,
            "location-type": attributeSChemaType,
            "hosting-provider": attributeSChemaType,
            "hardware-cpu": attributeSChemaType,
            "hardware-cpu-arch": attributeSChemaType,
            "hardware-gpu": attributeSChemaType,
            "hardware-gpu-model": attributeSChemaType,
            "hardware-disk": attributeSChemaType,
            "hardware-memory": attributeSChemaType,
            "network-provider": attributeSChemaType,
            "network-speed-up": attributeSChemaType,
            "network-speed-down": attributeSChemaType,
            "feat-persistent-storage": attributeSChemaType,
            "feat-persistent-storage-type": attributeSChemaType,
            "workload-support-chia": attributeSChemaType,
            "workload-support-chia-capabilities": attributeSChemaType,
            "feat-endpoint-ip": attributeSChemaType,
            "feat-endpoint-custom-domain": attributeSChemaType
          })
        }
      }
    },
    400: {
      description: "Invalid address"
    }
  }
});

export default new OpenAPIHono().openapi(route, async (c) => {
  const providerAttributesSchema = await getProviderAttributesSchema();
  return c.json(providerAttributesSchema);
});
