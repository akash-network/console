import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY, SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { MarketplaceTemplateController } from "@src/template-marketplace/controllers/marketplace-template/marketplace-template.controller";
import {
  GetUserTemplateResponseSchema,
  GetUserTemplateVersionResponseSchema,
  ListUserTemplateVersionsResponseSchema,
  UserTemplateParamsSchema,
  UserTemplateVersionParamsSchema
} from "@src/template-marketplace/http-schemas/marketplace-template.schema";
import {
  CreateUserTemplateRequestSchema,
  CreateUserTemplateResponseSchema,
  CreateUserTemplateVersionRequestSchema,
  CreateUserTemplateVersionResponseSchema,
  ListUserTemplatesQuerySchema,
  ListUserTemplatesResponseSchema,
  UpdateUserTemplateRequestSchema,
  UpdateUserTemplateResponseSchema
} from "@src/template-marketplace/http-schemas/template-writes.schema";
import { MAX_LISTED_USER_TEMPLATES } from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";

export const marketplaceTemplatesRouter = new OpenApiHonoHandler();

const NOT_FOUND_DESCRIPTION = "The template does not exist or the caller may not read it";

const getUserTemplateRoute = createRoute({
  method: "get",
  operationId: "getUserTemplate",
  path: "/v1/user-templates/{id}",
  summary: "Get a template the caller may read, with its current version",
  tags: ["Templates"],
  security: SECURITY_NONE,
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

/** Field caps bound characters, not bytes, so a body with every field at its cap can exceed the default limit once JSON-escaped. */
const MAX_TEMPLATE_WRITE_BODY_BYTES = 1024 * 1024;

const TEMPLATE_INVALID_DESCRIPTION = "The body is invalid, or the SDL or its asked values are refused (`template_invalid`, with the `issues` found)";

const createUserTemplateRoute = createRoute({
  method: "post",
  operationId: "createUserTemplate",
  path: "/v1/user-templates",
  summary: "Create a private template with its first version",
  tags: ["Templates"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  bodyLimit: { maxSize: MAX_TEMPLATE_WRITE_BODY_BYTES },
  request: {
    body: { content: { "application/json": { schema: CreateUserTemplateRequestSchema } }, required: true }
  },
  responses: {
    201: {
      description: "The template created",
      content: { "application/json": { schema: CreateUserTemplateResponseSchema } }
    },
    400: { description: `${TEMPLATE_INVALID_DESCRIPTION}, or a project must be named (\`project_required\`)` },
    401: { description: "The caller is not signed in" },
    403: { description: "The caller may not create templates" },
    404: { description: "The project or the template copied from does not exist or the caller may not read it" }
  }
});

marketplaceTemplatesRouter.openapi(createUserTemplateRoute, async function routeCreateUserTemplate(c) {
  return c.json(await container.resolve(MarketplaceTemplateController).createTemplate(c.req.valid("json")), 201);
});

const createUserTemplateVersionRoute = createRoute({
  method: "post",
  operationId: "createUserTemplateVersion",
  path: "/v1/user-templates/{id}/versions",
  summary: "Save a new version of a template the caller may change",
  tags: ["Templates"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  bodyLimit: { maxSize: MAX_TEMPLATE_WRITE_BODY_BYTES },
  request: {
    params: UserTemplateParamsSchema,
    body: { content: { "application/json": { schema: CreateUserTemplateVersionRequestSchema } }, required: true }
  },
  responses: {
    201: {
      description: "The version saved",
      content: { "application/json": { schema: CreateUserTemplateVersionResponseSchema } }
    },
    400: { description: TEMPLATE_INVALID_DESCRIPTION },
    401: { description: "The caller is not signed in" },
    403: { description: "The caller may read the template but not change it" },
    404: { description: NOT_FOUND_DESCRIPTION },
    409: { description: "Another version was saved after the base version (`template_version_conflict`)" }
  }
});

marketplaceTemplatesRouter.openapi(createUserTemplateVersionRoute, async function routeCreateUserTemplateVersion(c) {
  const { id } = c.req.valid("param");
  return c.json(await container.resolve(MarketplaceTemplateController).createVersion(id, c.req.valid("json")), 201);
});

const listUserTemplatesRoute = createRoute({
  method: "get",
  operationId: "listUserTemplates",
  path: "/v1/user-templates",
  summary: "List the active organization's templates the caller may read, most recently updated first",
  tags: ["Templates"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  request: {
    query: ListUserTemplatesQuerySchema
  },
  responses: {
    200: {
      description: `At most ${MAX_LISTED_USER_TEMPLATES} templates`,
      content: { "application/json": { schema: ListUserTemplatesResponseSchema } }
    },
    400: { description: "The visibility or the project id is invalid" },
    401: { description: "The caller is not signed in" }
  }
});

marketplaceTemplatesRouter.openapi(listUserTemplatesRoute, async function routeListUserTemplates(c) {
  return c.json(await container.resolve(MarketplaceTemplateController).listTemplates(c.req.valid("query")), 200);
});

const OUTSIDE_ORGANIZATION_DESCRIPTION =
  "The template belongs to another organization than the active one (`organization_forbidden`), or the caller may not change it";

const updateUserTemplateRoute = createRoute({
  method: "patch",
  operationId: "updateUserTemplate",
  path: "/v1/user-templates/{id}",
  summary: "Change the title, summary, icon, categories or visibility of a template the caller may change",
  tags: ["Templates"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  request: {
    params: UserTemplateParamsSchema,
    body: { content: { "application/json": { schema: UpdateUserTemplateRequestSchema } }, required: true }
  },
  responses: {
    200: {
      description: "The template changed",
      content: { "application/json": { schema: UpdateUserTemplateResponseSchema } }
    },
    400: { description: "The body changes no setting, or a setting is outside the catalog or its limits" },
    401: { description: "The caller is not signed in" },
    403: { description: OUTSIDE_ORGANIZATION_DESCRIPTION },
    404: { description: NOT_FOUND_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(updateUserTemplateRoute, async function routeUpdateUserTemplate(c) {
  const { id } = c.req.valid("param");
  return c.json(await container.resolve(MarketplaceTemplateController).updateTemplate(id, c.req.valid("json")), 200);
});

const deleteUserTemplateRoute = createRoute({
  method: "delete",
  operationId: "deleteUserTemplate",
  path: "/v1/user-templates/{id}",
  summary: "Delete a template the caller may delete, with its versions and favorites",
  tags: ["Templates"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  request: {
    params: UserTemplateParamsSchema
  },
  responses: {
    204: { description: "The template deleted" },
    400: { description: "The id is not a uuid" },
    401: { description: "The caller is not signed in" },
    403: { description: OUTSIDE_ORGANIZATION_DESCRIPTION },
    404: { description: NOT_FOUND_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(deleteUserTemplateRoute, async function routeDeleteUserTemplate(c) {
  const { id } = c.req.valid("param");
  await container.resolve(MarketplaceTemplateController).deleteTemplate(id);
  return c.body(null, 204);
});
