/** Keeps the token across the sign-up or log-in round trip, which returns to `/invitations` without the fragment. */
export const INVITATION_TOKEN_STORAGE_KEY = "organization-invitation-token";

export function readStoredInvitationToken(): string | null {
  return withSessionStorage(storage => storage.getItem(INVITATION_TOKEN_STORAGE_KEY)) ?? null;
}

export function storeInvitationToken(token: string): void {
  withSessionStorage(storage => storage.setItem(INVITATION_TOKEN_STORAGE_KEY, token));
}

export function forgetInvitationToken(): void {
  withSessionStorage(storage => storage.removeItem(INVITATION_TOKEN_STORAGE_KEY));
}

/** Session storage throws when the browser blocks it, which only costs the token surviving the round trip. */
function withSessionStorage<T>(operation: (storage: Storage) => T): T | undefined {
  try {
    return operation(window.sessionStorage);
  } catch {
    return undefined;
  }
}
