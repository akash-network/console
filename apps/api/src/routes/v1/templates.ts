import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { getTemplateGallery } from "@src/services/external/templateReposService";

const route = createRoute({
  method: "get",
  path: "/templates",
  tags: ["Other"],
  responses: {
    200: {
      description: "Returns a list of deployment templates grouped by cateogories",
      content: {
        "application/json": {
          schema: z.array(
            z.object({
              title: z.string(),
              templates: z.array(
                z.object({
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
              )
            })
          )
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const response = await cacheResponse(60 * 5, cacheKeys.getTemplates, async () => await getTemplateGallery());
  return c.json(response);
});
