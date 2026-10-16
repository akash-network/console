import type { operationDefs } from "@akashnetwork/console-api-types";

export type OrganizationMemberOutput = operationDefs["listOrganizationMembers"]["responses"][200]["content"]["application/json"]["data"][number];

export type OrganizationInvitationOutput = operationDefs["listOrganizationInvitations"]["responses"][200]["content"]["application/json"]["data"][number];

export type InvitationPreviewOutput = operationDefs["previewInvitation"]["responses"][200]["content"]["application/json"]["data"];

export const OWNER_ROLE_RESTRICTED_ERROR_CODE = "owner_role_restricted";

export const LAST_OWNER_ERROR_CODE = "last_owner";

export const ALREADY_MEMBER_ERROR_CODE = "already_member";

export const PERSONAL_ORGANIZATION_ERROR_CODE = "personal_organization";

export const INVITATION_LIMIT_REACHED_ERROR_CODE = "invitation_limit_reached";

export const INVITATION_EMAIL_LIMIT_REACHED_ERROR_CODE = "invitation_email_limit_reached";

export const INVITATION_EMAIL_MISMATCH_ERROR_CODE = "invitation_email_mismatch";

export const INVITATION_EXPIRED_ERROR_CODE = "invitation_expired";

export const INVITATION_REVOKED_ERROR_CODE = "invitation_revoked";

export const INVITATION_ALREADY_ACCEPTED_ERROR_CODE = "invitation_already_accepted";

export const SESSION_REQUIRED_ERROR_CODE = "session_required";

export const OWNER_CANNOT_LEAVE_ERROR_CODE = "owner_cannot_leave";
