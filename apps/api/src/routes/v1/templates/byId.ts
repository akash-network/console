import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getCachedTemplateById } from "@src/services/external/templateReposService";

const route = createRoute({
  method: "get",
  path: "/templates/{id}",
  tags: ["Other"],
  request: {
    params: z.object({
      id: z.string().openapi({
        description: "Template ID",
        example: "akash-network-cosmos-omnibus-agoric"
      })
    })
  },
  responses: {
    200: {
      description: "Return a template by id",
      content: {
        "application/json": {
          schema: z.object({
            id: z.string(),
            name: z.string(),
            path: z.string(),
            logoUrl: z.string().nullable(),
            summary: z.string(),
            readme: z.string().nullable(),
            deploy: z.string(),
            persistentStorageEnabled: z.boolean(),
            guide: z.string().nullable(),
            githubUrl: z.string(),
            config: z.object({
              ssh: z.boolean().optional()
            })
          })
        }
      }
    },
    404: {
      description: "Template not found"
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const templateId = c.req.valid("param").id;
  const template = await getCachedTemplateById(templateId);

  if (!template) {
    return c.text("Template not found", 404);
  }

  return c.json(template);
});
