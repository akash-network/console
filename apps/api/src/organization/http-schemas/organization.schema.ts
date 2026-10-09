import { z } from "@hono/zod-openapi";

import { organizationTypeEnum } from "@src/organization/model-schemas/organization/organization.schema";
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

export type OrganizationResponse = z.infer<typeof OrganizationSchema>;
export type ListOrganizationsResponse = z.infer<typeof ListOrganizationsResponseSchema>;
