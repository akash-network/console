import { z } from "@hono/zod-openapi";

import type { ProjectDeploymentStatus } from "@src/deployment/services/project-deployment-summary/project-deployment-summary.service";
import { MAX_PROJECT_DESCRIPTION_LENGTH, MAX_PROJECT_NAME_LENGTH } from "@src/organization/model-schemas/project/project.schema";

const PROJECT_DEPLOYMENT_STATUSES = ["pending", "running", "degraded"] as const satisfies readonly ProjectDeploymentStatus[];

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

const ProjectDeploymentSummarySchema = z
  .object({
    activeCount: z.number().int().nonnegative(),
    preview: z
      .array(
        z.object({
          dseq: z.string(),
          name: z.string().nullable(),
          status: z.enum(PROJECT_DEPLOYMENT_STATUSES).openapi({
            description: "`running` holds an open lease, `pending` holds no lease yet, `degraded` lost every lease it had while staying open."
          })
        })
      )
      .openapi({ description: "The newest few active deployments, newest first." })
  })
  .nullable()
  .openapi({ description: "Null when the caller may not read the project's deployments, or when too many are open to count." });

export const ListedProjectSchema = ProjectSchema.extend({
  lastActivityAt: z.string().datetime().openapi({
    description: "The later of the project's creation and its newest activity the caller may read, such as a deployment created, closed or moved in."
  }),
  deployments: ProjectDeploymentSummarySchema,
  access: z.object({
    canDeploy: z.boolean().openapi({ description: "Whether the caller may deploy into the project and change its deployments." }),
    canManage: z.boolean().openapi({ description: "Whether the caller may rename the project and decide who else reaches it." })
  })
});

export const ListProjectsResponseSchema = z.object({ data: z.array(ListedProjectSchema) });

export type ProjectResponseItem = z.infer<typeof ProjectSchema>;
export type ListedProjectResponseItem = z.infer<typeof ListedProjectSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type ListProjectsResponse = z.infer<typeof ListProjectsResponseSchema>;
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;
