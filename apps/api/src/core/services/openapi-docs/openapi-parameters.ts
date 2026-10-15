import type { ParameterObject } from "openapi3-ts/oas30";

import { ORGANIZATION_ID_HEADER, PROJECT_ID_HEADER } from "@src/organization/services/organization-context/organization-context.resolver";

export const ORGANIZATION_CONTEXT_PARAMETERS = {
  OrganizationIdHeader: {
    name: ORGANIZATION_ID_HEADER,
    in: "header",
    required: false,
    schema: { type: "string" },
    description:
      "Id or slug of the organization the request runs in. Defaults to the organization used last, or the caller's personal one. " +
      "Answers 403 `organization_forbidden` when the caller is not a member, and 400 `organization_mismatch` when it names another organization than the API key's."
  },
  ProjectIdHeader: {
    name: PROJECT_ID_HEADER,
    in: "header",
    required: false,
    schema: { type: "string", format: "uuid" },
    description:
      "Id of a project of the active organization to limit the request to. " +
      "Answers 403 `project_forbidden` when the caller cannot reach the project, or the API key is limited to another one."
  }
} satisfies Record<string, ParameterObject>;
