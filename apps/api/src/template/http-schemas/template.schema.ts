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

export const TemplateHardwareSchema = z.object({
  cpu: z.number().openapi({ description: "vCPUs across every service and replica" }),
  memoryBytes: z.number(),
  storageBytes: z.number().openapi({ description: "Ephemeral and persistent storage combined" }),
  gpu: z
    .object({
      units: z.number(),
      models: z.array(z.string()).openapi({ description: "Model names, or a vendor name when any of its models will do; empty when any GPU will do" })
    })
    .optional()
});

export const TemplateSummarySchema = TemplateSchema.pick({
  id: true,
  name: true,
  logoUrl: true,
  summary: true
}).extend({
  tags: z.array(z.string()).optional(),
  hardware: TemplateHardwareSchema.optional().openapi({ description: "Absent when the template's SDL cannot be read" })
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
