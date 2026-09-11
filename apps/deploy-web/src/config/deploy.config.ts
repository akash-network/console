export const USER_TEMPLATE_CODE = "USER_TEMPLATE";

/** Mirrors `DeploymentNameSchema` in apps/api, which refuses a longer name and fails the whole create or rename rather than just the name. */
export const MAX_DEPLOYMENT_NAME_LENGTH = 256;
