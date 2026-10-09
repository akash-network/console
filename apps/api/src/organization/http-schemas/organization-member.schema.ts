import { z } from "@hono/zod-openapi";

import { organizationRoleEnum } from "@src/organization/model-schemas/organization-member/organization-member.schema";

const OrganizationRoleSchema = z.enum(organizationRoleEnum.enumValues);

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
    role: OrganizationRoleSchema
  })
});

export type OrganizationMemberResponse = z.infer<typeof OrganizationMemberResponseSchema>;
export type ListOrganizationMembersResponse = z.infer<typeof ListOrganizationMembersResponseSchema>;
export type UpdateOrganizationMemberRequest = z.infer<typeof UpdateOrganizationMemberRequestSchema>;
