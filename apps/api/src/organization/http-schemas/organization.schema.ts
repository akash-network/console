import { z } from "@hono/zod-openapi";

import { MAX_ORGANIZATION_NAME_LENGTH, organizationTypeEnum } from "@src/organization/model-schemas/organization/organization.schema";
import { organizationRoleEnum } from "@src/organization/model-schemas/organization-member/organization-member.schema";

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  type: z.enum(organizationTypeEnum.enumValues),
  role: z.enum(organizationRoleEnum.enumValues).openapi({ description: "The caller's role in the organization." }),
  isActive: z.boolean().openapi({ description: "Whether this request ran in this organization." }),
  createdAt: z.string().datetime()
});

export const ListOrganizationsResponseSchema = z.object({
  data: z.array(OrganizationSchema)
});

export const OrganizationResponseSchema = z.object({
  data: OrganizationSchema
});

const OrganizationNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_ORGANIZATION_NAME_LENGTH)
  .regex(/^[^\p{Cc}\p{Bidi_Control}]+$/u, "The name cannot contain control characters")
  .regex(/[^\s\p{Z}\p{Cf}\p{Default_Ignorable_Code_Point}\u2800]/u, "The name needs at least one visible character")
  .openapi({ description: "Unique, ignoring case, among the organizations the caller belongs to." });

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

export type OrganizationResponse = z.infer<typeof OrganizationSchema>;
export type ListOrganizationsResponse = z.infer<typeof ListOrganizationsResponseSchema>;
export type SingleOrganizationResponse = z.infer<typeof OrganizationResponseSchema>;
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequestSchema>;
export type UpdateOrganizationRequest = z.infer<typeof UpdateOrganizationRequestSchema>;
