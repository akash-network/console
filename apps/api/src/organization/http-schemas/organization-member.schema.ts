import { z } from "@hono/zod-openapi";

import { organizationRoleEnum, projectAccessEnum } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { projectRoleEnum } from "@src/organization/model-schemas/project-member/project-member.schema";

const OrganizationRoleSchema = z.enum(organizationRoleEnum.enumValues);

export const ProjectAccessSchema = z.enum(projectAccessEnum.enumValues).openapi({
  description: "`all` reaches every project of the organization, including ones created later. `selected` reaches only the granted ones."
});

export const ProjectGrantSchema = z.object({
  projectId: z.string().uuid(),
  role: z.enum(projectRoleEnum.enumValues)
});

export const ProjectGrantsSchema = z
  .array(ProjectGrantSchema)
  .refine(grants => new Set(grants.map(grant => grant.projectId)).size === grants.length, { message: "Each project can be granted only once" });

export const OrganizationMemberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string().nullable(),
  email: z.string().nullable(),
  role: OrganizationRoleSchema,
  projectAccess: ProjectAccessSchema.nullable().openapi({
    description: "`all` for owners and admins, the stored access for members and viewers, null for billing members, who reach no project."
  }),
  projectCount: z.number().int().nullable().openapi({ description: "The live projects a member or viewer on `selected` is granted, null for everyone else." }),
  createdAt: z.string().datetime()
});

export const ListOrganizationMembersResponseSchema = z.object({
  data: z.array(OrganizationMemberSchema)
});

export const OrganizationMemberResponseSchema = z.object({
  data: OrganizationMemberSchema
});

export const OrganizationMemberParamsSchema = z.object({
  id: z.string().uuid()
});

export const UpdateOrganizationMemberRequestSchema = z.object({
  data: z
    .object({
      role: OrganizationRoleSchema.optional(),
      projectAccess: ProjectAccessSchema.optional().openapi({
        description:
          "Required when someone becomes a member or viewer from another role, refused with `project_access_required` otherwise. A member or viewer on `selected` needs at least one project grant. Ignored for owners, admins and billing members."
      }),
      projectGrants: ProjectGrantsSchema.optional().openapi({
        description:
          "Replaces every grant of a member or viewer on `selected`, in the body or already stored: grants not listed are removed. Refused for anyone else. Switching to `all` removes the member and viewer grants and keeps the admin ones."
      })
    })
    .refine(change => Object.values(change).some(value => value !== undefined), { message: "Change at least one of role, projectAccess or projectGrants" })
});

export const ListOrganizationMemberProjectGrantsResponseSchema = z.object({
  data: z.array(ProjectGrantSchema).openapi({ description: "The member's grants on live projects, oldest first." })
});

export type OrganizationMemberResponse = z.infer<typeof OrganizationMemberResponseSchema>;
export type ListOrganizationMembersResponse = z.infer<typeof ListOrganizationMembersResponseSchema>;
export type UpdateOrganizationMemberRequest = z.infer<typeof UpdateOrganizationMemberRequestSchema>;
export type ListOrganizationMemberProjectGrantsResponse = z.infer<typeof ListOrganizationMemberProjectGrantsResponseSchema>;
