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

export const TemplateCategorySchema = z.object({
  title: z.string(),
  templates: z.array(TemplateSchema)
});

export const GetTemplatesFullResponseSchema = z.array(TemplateCategorySchema);
export type GetTemplatesFullResponse = z.infer<typeof GetTemplatesFullResponseSchema>;

export const GetTemplatesListResponseSchema = z.object({
  data: z.array(TemplateCategorySchema)
});
export type GetTemplatesListResponse = z.infer<typeof GetTemplatesListResponseSchema>;

export const GetTemplateByIdParamsSchema = z.object({
  id: z.string().openapi({
    description: "Template ID",
    example: "akash-network-cosmos-omnibus-agoric"
  })
});

export const GetTemplateByIdResponseSchema = z.object({
  data: TemplateSchema
});
export type GetTemplateByIdResponse = z.infer<typeof GetTemplateByIdResponseSchema>;
