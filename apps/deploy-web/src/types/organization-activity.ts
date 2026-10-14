import type { operationDefs } from "@akashnetwork/console-api-types";

/** The response of `GET /v1/organization-activities` (`listOrganizationActivities`). */
export type OrganizationActivitiesPage = operationDefs["listOrganizationActivities"]["responses"][200]["content"]["application/json"];

export type OrganizationActivity = OrganizationActivitiesPage["data"][number];

export type OrganizationActivityType = OrganizationActivity["type"];

export type OrganizationActivityActor = NonNullable<OrganizationActivity["actor"]>;

/** The payload fields the feed reads; the api types the payload loosely, so each is read only when it is a string. */
export interface OrganizationActivityPayload {
  projectName?: string;
  email?: string;
  role?: string;
  dseq?: string;
  name?: string;
  reason?: string;
  toProjectName?: string;
  username?: string;
}

const PAYLOAD_FIELDS = [
  "projectName",
  "email",
  "role",
  "dseq",
  "name",
  "reason",
  "toProjectName",
  "username"
] as const satisfies readonly (keyof OrganizationActivityPayload)[];

export function readActivityPayload(payload: OrganizationActivity["payload"]): OrganizationActivityPayload {
  return Object.fromEntries(PAYLOAD_FIELDS.flatMap(field => (typeof payload[field] === "string" ? [[field, payload[field]]] : [])));
}
