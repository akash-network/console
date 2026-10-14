import type { OrganizationType } from "@src/organization/model-schemas/organization/organization.schema";

/** Events stay keyed by the acting user; the organization that paid rides along as properties. */
export function organizationAnalyticsProperties(organization: { id?: string | null; type?: OrganizationType } | undefined) {
  if (!organization?.id) return {};

  return { organization_id: organization.id, organization_type: organization.type };
}
