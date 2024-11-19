import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { getCachedTemplatesGallery } from "@src/services/external/templateReposService";

const responseSchema = z.array(
  z.object({
    title: z.string(),
    templates: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        logoUrl: z.string().nullable(),
        summary: z.string(),
      })
    )
  })
);
const route = createRoute({
  method: "get",
  path: "/templates-list",
  tags: ["Other"],
  responses: {
    200: {
      description: "Returns a list of deployment templates grouped by categories",
      content: {
        "application/json": {
          schema: responseSchema
        }
      }
    }
  }
});

export default new OpenAPIHono().openapi(route, async c => {
  const templatesPerCategory = await getCachedTemplatesGallery();
  // TODO: remove manual response filtering when https://github.com/honojs/middleware/issues/181 is done
  const filteredTemplatesPerCategory = await responseSchema.safeParseAsync(templatesPerCategory);
  const response = filteredTemplatesPerCategory.success
    ? filteredTemplatesPerCategory.data
    : templatesPerCategory;
  return c.json(response);
});
