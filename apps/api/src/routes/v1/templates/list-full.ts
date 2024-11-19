import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getCachedTemplatesGallery } from "@src/services/external/templateReposService";

const route = createRoute({
  method: "get",
  path: "/templates",
  tags: ["Other"],
  responses: {
    200: {
      description: "Returns a list of deployment templates grouped by categories",
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

/**
 * @deprecated should stay for some time in order to let UI to migrate to shorten list version.
 */
export default new OpenAPIHono().openapi(route, async c => {
  const templatesPerCategory = await getCachedTemplatesGallery();
  return c.json(templatesPerCategory);
});
