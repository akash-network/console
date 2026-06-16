import { faker } from "@faker-js/faker";
import type { GetUsers200ResponseOneOfInner, GetUsers200ResponseOneOfInnerIdentitiesInner } from "auth0";

export function createAuth0Identity(overrides: Partial<GetUsers200ResponseOneOfInnerIdentitiesInner> = {}): GetUsers200ResponseOneOfInnerIdentitiesInner {
  return {
    connection: "Username-Password-Authentication",
    provider: "auth0",
    user_id: faker.string.uuid(),
    isSocial: false,
    ...overrides
  } as GetUsers200ResponseOneOfInnerIdentitiesInner;
}

export function createAuth0User(overrides: Partial<GetUsers200ResponseOneOfInner> = {}): Partial<GetUsers200ResponseOneOfInner> {
  const identities = overrides.identities ?? [identityFromUserId(overrides.user_id)];
  if (!overrides.user_id && identities.length === 0) {
    throw new Error("createAuth0User requires a user_id or at least one identity to derive it from");
  }
  const userId = overrides.user_id ?? `${identities[0].provider}|${identities[0].user_id}`;

  return {
    user_id: userId,
    email: faker.internet.email(),
    email_verified: faker.datatype.boolean(),
    name: faker.person.fullName(),
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    identities,
    ...overrides
  };
}

/**
 * Builds a root identity consistent with a composite `provider|id` user_id so a
 * seeded user's `identities[0]` reconstructs its top-level `user_id`. Defaults to
 * a random `auth0` identity when no user_id is given.
 */
function identityFromUserId(userId?: string): GetUsers200ResponseOneOfInnerIdentitiesInner {
  if (!userId) {
    return createAuth0Identity();
  }

  const separatorIndex = userId.indexOf("|");
  const provider = separatorIndex >= 0 ? userId.slice(0, separatorIndex) : "auth0";
  const id = separatorIndex >= 0 ? userId.slice(separatorIndex + 1) : userId;

  return createAuth0Identity({ provider, user_id: id, connection: provider === "auth0" ? "Username-Password-Authentication" : provider });
}
