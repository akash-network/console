import type { operationDefs } from "@akashnetwork/console-api-types";

export type ListOrganizationsResponse = operationDefs["listOrganizations"]["responses"][200]["content"]["application/json"];

export type OrganizationOutput = ListOrganizationsResponse["data"][number];

export type OrganizationType = OrganizationOutput["type"];

export type OrganizationRole = OrganizationOutput["role"];

export type CreateOrganizationInput = operationDefs["createOrganization"]["requestBody"]["content"]["application/json"];

export type CreateOrganizationInvitationsInput = operationDefs["createOrganizationInvitations"]["requestBody"]["content"]["application/json"];

export const ORGANIZATION_NAME_TAKEN_ERROR_CODE = "organization_name_taken";

export const ORGANIZATION_LIMIT_REACHED_ERROR_CODE = "organization_limit_reached";

export const ORGANIZATION_FORBIDDEN_ERROR_CODE = "organization_forbidden";

export const VALIDATION_ERROR_CODE = "validation_error";
