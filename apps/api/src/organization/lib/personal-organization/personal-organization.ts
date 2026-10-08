import { MAX_ORGANIZATION_NAME_LENGTH } from "@src/organization/model-schemas/organization/organization.schema";

export const PERSONAL_ORGANIZATION_SLUG_PREFIX = "personal-";
export const FALLBACK_PERSONAL_ORGANIZATION_NAME = "Personal";

/** Enough of the user uuid to keep personal slugs apart while leaving room for a collision suffix inside the column. */
const SLUG_USER_ID_HEX_LENGTH = 12;

export function personalOrganizationSlug(userId: string, collisions = 0): string {
  const slug = `${PERSONAL_ORGANIZATION_SLUG_PREFIX}${userId.replace(/-/g, "").slice(0, SLUG_USER_ID_HEX_LENGTH)}`;

  return collisions > 0 ? `${slug}-${collisions + 1}` : slug;
}

export function personalOrganizationName(username: string | null | undefined): string {
  return username ? username.slice(0, MAX_ORGANIZATION_NAME_LENGTH) : FALLBACK_PERSONAL_ORGANIZATION_NAME;
}
