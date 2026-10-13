import { z } from "@hono/zod-openapi";

import { organizationRoleEnum } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { projectRoleEnum } from "@src/organization/model-schemas/project-member/project-member.schema";

export const MAX_INVITATION_EMAILS_PER_REQUEST = 20;

const OrganizationRoleSchema = z.enum(organizationRoleEnum.enumValues);

const ProjectGrantSchema = z.object({
  projectId: z.string().uuid(),
  role: z.enum(projectRoleEnum.enumValues)
});

export const OrganizationInvitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: OrganizationRoleSchema,
  projectGrants: z.array(ProjectGrantSchema),
  invitedBy: z.object({ id: z.string().uuid(), username: z.string().nullable() }).nullable(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime()
});

export const ListOrganizationInvitationsResponseSchema = z.object({
  data: z.array(OrganizationInvitationSchema)
});

export const OrganizationInvitationResponseSchema = z.object({
  data: OrganizationInvitationSchema
});

export const CreateOrganizationInvitationsRequestSchema = z.object({
  data: z.object({
    emails: z.array(z.string().trim().email().max(255)).min(1).max(MAX_INVITATION_EMAILS_PER_REQUEST),
    role: OrganizationRoleSchema,
    projectGrants: z
      .array(ProjectGrantSchema)
      .refine(grants => new Set(grants.map(grant => grant.projectId)).size === grants.length, { message: "Each project can be granted only once" })
      .optional()
  })
});

export const OrganizationInvitationParamsSchema = z.object({
  id: z.string().uuid()
});

export const OrganizationInvitationLinkResponseSchema = z.object({
  data: z.object({ url: z.string().url() })
});

export type OrganizationInvitationResponse = z.infer<typeof OrganizationInvitationResponseSchema>;
export type ListOrganizationInvitationsResponse = z.infer<typeof ListOrganizationInvitationsResponseSchema>;
export type CreateOrganizationInvitationsRequest = z.infer<typeof CreateOrganizationInvitationsRequestSchema>;
export type OrganizationInvitationLinkResponse = z.infer<typeof OrganizationInvitationLinkResponseSchema>;
