import { z } from "@hono/zod-openapi";

import { toSlug } from "@src/organization/lib/slug/slug";
import { MAX_PROJECT_DESCRIPTION_LENGTH, MAX_PROJECT_NAME_LENGTH } from "@src/organization/model-schemas/project/project.schema";

const ProjectNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_PROJECT_NAME_LENGTH)
  .refine(name => toSlug(name).length > 0, { message: "A project name needs at least one letter or number" })
  .openapi({ description: "Also gives the project its slug, which must be unique within the organization.", example: "checkout-api" });

const ProjectDescriptionSchema = z.string().trim().max(MAX_PROJECT_DESCRIPTION_LENGTH);

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  createdBy: z.object({ id: z.string().uuid(), username: z.string().nullable() }).nullable()
});

export const ProjectParamsSchema = z.object({
  id: z
    .string()
    .uuid()
    .openapi({ param: { name: "id", in: "path" } })
});

export const CreateProjectRequestSchema = z.object({
  data: z.object({ name: ProjectNameSchema, description: ProjectDescriptionSchema.optional() })
});

export const UpdateProjectRequestSchema = z.object({
  data: z.object({ name: ProjectNameSchema.optional(), description: ProjectDescriptionSchema.nullable().optional() })
});

export const ProjectResponseSchema = z.object({ data: ProjectSchema });

export const ListProjectsResponseSchema = z.object({ data: z.array(ProjectSchema) });

export type ProjectResponseItem = z.infer<typeof ProjectSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type ListProjectsResponse = z.infer<typeof ListProjectsResponseSchema>;
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;
