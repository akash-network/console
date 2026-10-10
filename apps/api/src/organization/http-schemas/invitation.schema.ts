import { z } from "@hono/zod-openapi";

import { OrganizationSchema } from "@src/organization/http-schemas/organization.schema";
import { INVITATION_TOKEN_PATTERN } from "@src/organization/lib/invitation-token/invitation-token";
import { organizationInvitationStatusEnum } from "@src/organization/model-schemas/organization-invitation/organization-invitation.schema";
import { organizationRoleEnum } from "@src/organization/model-schemas/organization-member/organization-member.schema";

const InvitationTokenSchema = z
  .string()
  .regex(INVITATION_TOKEN_PATTERN, "Not an invitation token")
  .openapi({ description: "The token from the invitation link." });

export const PreviewInvitationRequestSchema = z.object({
  data: z.object({
    token: InvitationTokenSchema
  })
});

export const InvitationPreviewResponseSchema = z.object({
  data: z.object({
    organizationName: z.string(),
    inviterName: z.string().nullable(),
    role: z.enum(organizationRoleEnum.enumValues),
    email: z.string().openapi({ description: "The address the invitation was sent to." }),
    status: z.enum([...organizationInvitationStatusEnum.enumValues, "expired"]),
    expiresAt: z.string().datetime()
  })
});

export const AcceptInvitationRequestSchema = z.object({
  data: z.object({
    token: InvitationTokenSchema,
    confirmEmailMismatch: z
      .boolean()
      .optional()
      .openapi({ description: "Join even though the caller's email differs from the address the invitation was sent to." })
  })
});

export const AcceptInvitationResponseSchema = z.object({
  data: OrganizationSchema
});

export type PreviewInvitationRequest = z.infer<typeof PreviewInvitationRequestSchema>;
export type InvitationPreviewResponse = z.infer<typeof InvitationPreviewResponseSchema>;
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequestSchema>;
export type AcceptInvitationResponse = z.infer<typeof AcceptInvitationResponseSchema>;
