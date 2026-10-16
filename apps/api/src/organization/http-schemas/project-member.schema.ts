import { z } from "@hono/zod-openapi";

import { projectRoleEnum } from "@src/organization/model-schemas/project-member/project-member.schema";

const ProjectRoleSchema = z.enum(projectRoleEnum.enumValues).openapi({
  description:
    "`viewer` reads the project; `member` also deploys into it and changes its deployments, templates and alerts; `admin` also renames it and manages the other grants on it. An organization viewer only reads, whatever the project role."
});

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
    userId: z.string().uuid().openapi({ description: "A member or viewer of the active organization other than the caller." }),
    role: ProjectRoleSchema
  })
});

export const UpdateProjectMemberRequestSchema = z.object({
  data: z.object({ role: ProjectRoleSchema })
});

export const ProjectMemberResponseSchema = z.object({ data: ProjectMemberSchema });

export const ProjectMemberWithAllProjectsSchema = z.object({
  userId: z.string().uuid(),
  username: z.string().nullable(),
  email: z.string().nullable(),
  role: ProjectRoleSchema,
  createdAt: z.string().datetime().openapi({ description: "When they joined the organization." })
});

export const ListProjectMembersResponseSchema = z.object({
  data: z.array(ProjectMemberSchema).openapi({ description: "Explicit grants only, oldest first. Owners and admins reach every project without one." }),
  membersWithAllProjects: z.array(ProjectMemberWithAllProjectsSchema).openapi({
    description:
      "Members and viewers of the organization who reach every project and hold no grant on this one, oldest first. Their access is changed on the organization's members, not on the project."
  })
});

export type ProjectMemberResponseItem = z.infer<typeof ProjectMemberSchema>;
export type ProjectMemberWithAllProjectsResponseItem = z.infer<typeof ProjectMemberWithAllProjectsSchema>;
export type ProjectMemberResponse = z.infer<typeof ProjectMemberResponseSchema>;
export type ListProjectMembersResponse = z.infer<typeof ListProjectMembersResponseSchema>;
export type CreateProjectMemberRequest = z.infer<typeof CreateProjectMemberRequestSchema>;
export type UpdateProjectMemberRequest = z.infer<typeof UpdateProjectMemberRequestSchema>;
