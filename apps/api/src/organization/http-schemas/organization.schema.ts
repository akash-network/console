import { z } from "@hono/zod-openapi";

import { readableName } from "@src/core/lib/readable-text/readable-text";
import { MAX_ORGANIZATION_NAME_LENGTH, organizationTypeEnum } from "@src/organization/model-schemas/organization/organization.schema";
import { organizationRoleEnum } from "@src/organization/model-schemas/organization-member/organization-member.schema";

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  type: z.enum(organizationTypeEnum.enumValues),
  role: z.enum(organizationRoleEnum.enumValues).openapi({ description: "The caller's role in the organization." }),
  isActive: z.boolean().openapi({ description: "Whether this request ran in this organization." }),
  hasPaymentMethod: z.boolean().nullable().openapi({
    description:
      "Whether the organization has a payment method saved, its owner's own cards for a personal organization. Null for an organization this request did not run in."
  }),
  createdAt: z.string().datetime()
});

export const ListOrganizationsResponseSchema = z.object({
  data: z.array(OrganizationSchema)
});

export const OrganizationResponseSchema = z.object({
  data: OrganizationSchema
});

const OrganizationNameSchema = readableName(z.string().trim().min(1).max(MAX_ORGANIZATION_NAME_LENGTH)).openapi({
  description:
    "Creating or renaming is refused when the caller already belongs to another organization of this name, ignoring case. Organizations joined by invitation may share a name."
});

export const CreateOrganizationRequestSchema = z.object({
  data: z.object({
    name: OrganizationNameSchema
  })
});

export const UpdateOrganizationRequestSchema = z.object({
  data: z.object({
    name: OrganizationNameSchema
  })
});

export const OrganizationParamsSchema = z.object({
  id: z.string().uuid()
});

export const DeleteOrganizationQuerySchema = z.object({
  acknowledgedForfeitUsd: z.coerce.number().min(0).optional().default(0).openapi({
    type: "number",
    description:
      "The credits, in USD, the owner was shown and agreed to forfeit, compared to the cent; deleting is refused while the organization holds more, and the refusal reports the `balanceUsd` to send.",
    example: 12.5
  })
});

export type OrganizationResponse = z.infer<typeof OrganizationSchema>;
export type ListOrganizationsResponse = z.infer<typeof ListOrganizationsResponseSchema>;
export type SingleOrganizationResponse = z.infer<typeof OrganizationResponseSchema>;
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequestSchema>;
export type UpdateOrganizationRequest = z.infer<typeof UpdateOrganizationRequestSchema>;
export type DeleteOrganizationQuery = z.output<typeof DeleteOrganizationQuerySchema>;
