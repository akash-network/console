import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";

import {
  ALREADY_MEMBER_ERROR_CODE,
  INVITATION_ALREADY_ACCEPTED_ERROR_CODE,
  INVITATION_EMAIL_LIMIT_REACHED_ERROR_CODE,
  INVITATION_EXPIRED_ERROR_CODE,
  INVITATION_LIMIT_REACHED_ERROR_CODE,
  INVITATION_REVOKED_ERROR_CODE,
  LAST_OWNER_ERROR_CODE,
  OWNER_ROLE_RESTRICTED_ERROR_CODE,
  PERSONAL_ORGANIZATION_ERROR_CODE,
  SESSION_REQUIRED_ERROR_CODE
} from "@src/types/organizationMembership";

const MEMBERSHIP_ERROR_MESSAGES = new Map<string, string>([
  [OWNER_ROLE_RESTRICTED_ERROR_CODE, "Only the owner can change the owner's role or hand over ownership."],
  [LAST_OWNER_ERROR_CODE, "An organization needs at least one owner."],
  [ALREADY_MEMBER_ERROR_CODE, "Someone you invited is already a member."],
  [PERSONAL_ORGANIZATION_ERROR_CODE, "You can't invite people to a personal account."],
  [INVITATION_LIMIT_REACHED_ERROR_CODE, "This organization has too many pending invitations. Revoke some to invite more."],
  [INVITATION_EMAIL_LIMIT_REACHED_ERROR_CODE, "Too many invitation emails were sent recently. Try again later."],
  [INVITATION_EXPIRED_ERROR_CODE, "This invitation has expired."],
  [INVITATION_REVOKED_ERROR_CODE, "This invitation was revoked."],
  [INVITATION_ALREADY_ACCEPTED_ERROR_CODE, "This invitation has already been accepted."],
  [SESSION_REQUIRED_ERROR_CODE, "Sign in again to accept this invitation."]
]);

/** The message for a refusal the API explains with an error code, or the fallback for anything else. */
export function getMembershipErrorMessage(error: unknown, fallback: string): string {
  return MEMBERSHIP_ERROR_MESSAGES.get(extractApiErrorCode(error) ?? "") ?? fallback;
}
