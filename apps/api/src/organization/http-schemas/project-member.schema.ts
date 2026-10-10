import { z } from "@hono/zod-openapi";

import { projectRoleEnum } from "@src/organization/model-schemas/project-member/project-member.schema";

const ProjectRoleSchema = z.enum(projectRoleEnum.enumValues);

export const ProjectMemberSchema = z.object({
  id: z.string().uuid().openapi({ description: "The grant id, used to change or revoke it." }),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string().nullable(),
  email: z.string().nullable(),
  role: ProjectRoleSchema,
  createdAt: z.string().datetime()
});

export const ProjectMemberParamsSchema = z.object({
  id: z
    .string()
    .uuid()
    .openapi({ param: { name: "id", in: "path" } })
});

export const CreateProjectMemberRequestSchema = z.object({
  data: z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid().openapi({ description: "A member or viewer of the active organization." }),
    role: ProjectRoleSchema
  })
});

export const UpdateProjectMemberRequestSchema = z.object({
  data: z.object({ role: ProjectRoleSchema })
});

export const ProjectMemberResponseSchema = z.object({ data: ProjectMemberSchema });

export const ListProjectMembersResponseSchema = z.object({
  data: z.array(ProjectMemberSchema).openapi({ description: "Explicit grants only, oldest first. Owners and admins reach every project without one." })
});

export type ProjectMemberResponseItem = z.infer<typeof ProjectMemberSchema>;
export type ProjectMemberResponse = z.infer<typeof ProjectMemberResponseSchema>;
export type ListProjectMembersResponse = z.infer<typeof ListProjectMembersResponseSchema>;
export type CreateProjectMemberRequest = z.infer<typeof CreateProjectMemberRequestSchema>;
export type UpdateProjectMemberRequest = z.infer<typeof UpdateProjectMemberRequestSchema>;
