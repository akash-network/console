import { z } from "@hono/zod-openapi";

import { organizationRoleEnum, projectAccessEnum } from "@src/organization/model-schemas/organization-member/organization-member.schema";

const OrganizationRoleSchema = z.enum(organizationRoleEnum.enumValues);

export const ProjectAccessSchema = z.enum(projectAccessEnum.enumValues).openapi({
  description: "`all` reaches every project of the organization, including ones created later. `selected` reaches only the granted ones."
});

export const OrganizationMemberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string().nullable(),
  email: z.string().nullable(),
  role: OrganizationRoleSchema,
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
  data: z.object({
    role: OrganizationRoleSchema,
    projectAccess: ProjectAccessSchema.optional().openapi({
      description:
        "Required when someone becomes a member or viewer from another role, refused with `project_access_required` otherwise. A member or viewer on `selected` needs at least one project grant. Ignored for owners, admins and billing members."
    })
  })
});

export type OrganizationMemberResponse = z.infer<typeof OrganizationMemberResponseSchema>;
export type ListOrganizationMembersResponse = z.infer<typeof ListOrganizationMembersResponseSchema>;
export type UpdateOrganizationMemberRequest = z.infer<typeof UpdateOrganizationMemberRequestSchema>;
