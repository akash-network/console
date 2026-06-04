import { z } from "@hono/zod-openapi";

export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  logoUrl: z.string().nullable(),
  summary: z.string(),
  readme: z.string(),
  deploy: z.string(),
  persistentStorageEnabled: z.boolean(),
  guide: z.string().optional(),
  githubUrl: z.string(),
  config: z.object({
    ssh: z.boolean().optional()
  })
});

export const TemplateSummarySchema = TemplateSchema.pick({
  id: true,
  name: true,
  logoUrl: true,
  summary: true
}).extend({
  tags: z.array(z.string()).optional()
});

export const TemplateCategorySchema = z.object({
  title: z.string(),
  templates: z.array(TemplateSummarySchema)
});

export const GetTemplatesListResponseSchema = z.object({
  data: z.array(TemplateCategorySchema)
});

export type GetTemplatesListResponse = z.infer<typeof GetTemplatesListResponseSchema>;

export const GetTemplateByIdParamsSchema = z.object({
  // Template ids never contain a path separator (they're built by collapsing "/" and "\" to "-"),
  // so rejecting them here blocks path traversal before the id reaches the filesystem.
  id: z
    .string()
    .regex(/^[^/\\]+$/, "Invalid template ID")
    .openapi({
      description: "Template ID",
      example: "akash-network-cosmos-omnibus-agoric"
    })
});

export const GetTemplateByIdResponseSchema = z.object({ data: TemplateSchema });
export type GetTemplateByIdResponse = z.infer<typeof GetTemplateByIdResponseSchema>;
