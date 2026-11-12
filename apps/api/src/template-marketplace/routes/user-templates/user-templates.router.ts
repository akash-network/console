import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { MarketplaceTemplateController } from "@src/template-marketplace/controllers/marketplace-template/marketplace-template.controller";
import {
  GetUserTemplateResponseSchema,
  GetUserTemplateVersionResponseSchema,
  ListUserTemplateVersionsResponseSchema,
  UserTemplateParamsSchema,
  UserTemplateVersionParamsSchema
} from "@src/template-marketplace/http-schemas/marketplace-template.schema";

export const marketplaceTemplatesRouter = new OpenApiHonoHandler();

const NOT_FOUND_DESCRIPTION = "The template does not exist or the caller may not read it";

const getUserTemplateRoute = createRoute({
  method: "get",
  operationId: "getUserTemplate",
  path: "/v1/user-templates/{id}",
  summary: "Get a template the caller may read, with its current version",
  tags: ["Templates"],
  security: SECURITY_NONE,
  readsOrganizationContext: true,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  request: {
    params: UserTemplateParamsSchema
  },
  responses: {
    200: {
      description: "The template",
      content: { "application/json": { schema: GetUserTemplateResponseSchema } }
    },
    400: { description: "The id is not a uuid" },
    404: { description: NOT_FOUND_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(getUserTemplateRoute, async function routeGetUserTemplate(c) {
  const { id } = c.req.valid("param");
  return c.json(await container.resolve(MarketplaceTemplateController).getTemplate(id), 200);
});

const listUserTemplateVersionsRoute = createRoute({
  method: "get",
  operationId: "listUserTemplateVersions",
  path: "/v1/user-templates/{id}/versions",
  summary: "List the versions of a template the caller may read, newest first",
  tags: ["Templates"],
  security: SECURITY_NONE,
  readsOrganizationContext: true,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  request: {
    params: UserTemplateParamsSchema
  },
  responses: {
    200: {
      description: "The template's versions",
      content: { "application/json": { schema: ListUserTemplateVersionsResponseSchema } }
    },
    400: { description: "The id is not a uuid" },
    404: { description: NOT_FOUND_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(listUserTemplateVersionsRoute, async function routeListUserTemplateVersions(c) {
  const { id } = c.req.valid("param");
  return c.json(await container.resolve(MarketplaceTemplateController).listVersions(id), 200);
});

const getUserTemplateVersionRoute = createRoute({
  method: "get",
  operationId: "getUserTemplateVersion",
  path: "/v1/user-templates/{id}/versions/{version}",
  summary: "Get one version of a template the caller may read",
  tags: ["Templates"],
  security: SECURITY_NONE,
  readsOrganizationContext: true,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  request: {
    params: UserTemplateVersionParamsSchema
  },
  responses: {
    200: {
      description: "The version",
      content: { "application/json": { schema: GetUserTemplateVersionResponseSchema } }
    },
    400: { description: "The id is not a uuid or the version is not a positive integer" },
    404: { description: "The template or the version does not exist, or the caller may not read the template" }
  }
});

marketplaceTemplatesRouter.openapi(getUserTemplateVersionRoute, async function routeGetUserTemplateVersion(c) {
  const { id, version } = c.req.valid("param");
  return c.json(await container.resolve(MarketplaceTemplateController).getVersion(id, version), 200);
});
