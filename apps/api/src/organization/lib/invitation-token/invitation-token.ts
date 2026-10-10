import { createHash, randomBytes } from "node:crypto";

const INVITATION_TOKEN_BYTES = 32;

/** Unpadded base64url of `INVITATION_TOKEN_BYTES` random bytes, so it has to change with that constant. */
export const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createInvitationToken(): string {
  return randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationUrl(deployWebBaseUrl: string, token: string): string {
  return `${deployWebBaseUrl}/invitations#token=${token}`;
}
