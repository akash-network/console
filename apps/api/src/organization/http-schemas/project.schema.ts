import { z } from "@hono/zod-openapi";

import { MAX_PROJECT_DESCRIPTION_LENGTH, MAX_PROJECT_NAME_LENGTH } from "@src/organization/model-schemas/project/project.schema";

const ProjectNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_PROJECT_NAME_LENGTH)
  .openapi({ description: "Unique within the organization, whatever its case.", example: "checkout-api" });

const ProjectDescriptionSchema = z.string().trim().max(MAX_PROJECT_DESCRIPTION_LENGTH);

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().openapi({ description: "Set from the name when the project is created and kept through renames." }),
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
