import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER, SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { OrganizationController } from "@src/organization/controllers/organization/organization.controller";
import {
  CreateOrganizationRequestSchema,
  ListOrganizationsResponseSchema,
  OrganizationParamsSchema,
  OrganizationResponseSchema,
  UpdateOrganizationRequestSchema
} from "@src/organization/http-schemas/organization.schema";

export const organizationsRouter = new OpenApiHonoHandler();

const listOrganizationsRoute = createRoute({
  method: "get",
  path: "/v1/organizations",
  operationId: "listOrganizations",
  summary: "List the organizations the caller belongs to, marking the one this request ran in",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  responses: {
    200: { description: "The caller's organizations", content: { "application/json": { schema: ListOrganizationsResponseSchema } } },
    400: { description: "The organization header names another organization than the API key's" },
    401: { description: "Unauthorized" },
    403: { description: "The organization or project header names one the caller cannot reach" }
  }
});

organizationsRouter.openapi(listOrganizationsRoute, async function routeListOrganizations(c) {
  return c.json(await container.resolve(OrganizationController).list(), 200);
});

const createOrganizationRoute = createRoute({
  method: "post",
  path: "/v1/organizations",
  operationId: "createOrganization",
  summary: "Create a team organization owned by the caller, with its default project and a wallet ready to fund",
  tags: ["Organizations"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    body: { required: true, content: { "application/json": { schema: CreateOrganizationRequestSchema } } }
  },
  responses: {
    201: { description: "The created organization", content: { "application/json": { schema: OrganizationResponseSchema } } },
    400: { description: "The name is empty, too long or holds a control character" },
    401: { description: "Unauthorized" },
    403: { description: "The caller cannot create more organizations, or the request was not made from a signed-in session" },
    409: { description: "The caller already belongs to an organization with this name" }
  }
});

organizationsRouter.openapi(createOrganizationRoute, async function routeCreateOrganization(c) {
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(OrganizationController).create(data, { authMethod: c.get("authMethod") }), 201);
});

const updateOrganizationRoute = createRoute({
  method: "patch",
  path: "/v1/organizations/{id}",
  operationId: "updateOrganization",
  summary: "Rename the active organization",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    params: OrganizationParamsSchema,
    body: { required: true, content: { "application/json": { schema: UpdateOrganizationRequestSchema } } }
  },
  responses: {
    200: { description: "The renamed organization", content: { "application/json": { schema: OrganizationResponseSchema } } },
    400: { description: "The name is empty, too long or holds a control character" },
    401: { description: "Unauthorized" },
    403: { description: "The caller cannot rename the organization, or it is a personal one" },
    404: { description: "The organization is not the active one" },
    409: { description: "The caller already belongs to another organization with this name" }
  }
});

organizationsRouter.openapi(updateOrganizationRoute, async function routeUpdateOrganization(c) {
  const { id } = c.req.valid("param");
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(OrganizationController).update(id, data), 200);
});
