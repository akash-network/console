export const PROJECT_FORBIDDEN_DESCRIPTION = "With `code` `project_forbidden`, the deployment is filed in a project the caller cannot change";

export const RECORD_UNFILED_DESCRIPTION =
  "With `code` `deployment_record_unfiled`, the member who filed this team deployment deleted their account and the caller holds a record of the same deployment id in another organization";

export const SECRETS_SEALED_FOR_DEPARTED_MEMBER_DESCRIPTION =
  "With `code` `stored_secrets_unavailable`, the stored secrets were sealed for a member who deleted their account, so update the deployment with its full SDL and secret values";
