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
  CreateTemplateViewRequestSchema,
  GetTemplateInsightsQuerySchema,
  GetTemplateInsightsResponseSchema
} from "@src/template-marketplace/http-schemas/template-insights.schema";
import {
  GetPublishReadinessResponseSchema,
  PublishUserTemplateRequestSchema,
  PublishUserTemplateResponseSchema
} from "@src/template-marketplace/http-schemas/template-publish.schema";
import { CreateTemplateReportRequestSchema, CreateTemplateReportResponseSchema } from "@src/template-marketplace/http-schemas/template-report.schema";
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

const REMOVED_DESCRIPTION = "The template was public once and has since been removed (`template_removed`, with the `title` it had)";

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
    404: { description: NOT_FOUND_DESCRIPTION },
    410: { description: REMOVED_DESCRIPTION }
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
    404: { description: NOT_FOUND_DESCRIPTION },
    410: { description: REMOVED_DESCRIPTION }
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
    404: { description: "The template or the version does not exist, or the caller may not read the template" },
    410: { description: REMOVED_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(getUserTemplateVersionRoute, async function routeGetUserTemplateVersion(c) {
  const { id, version } = c.req.valid("param");
  return c.json(await container.resolve(MarketplaceTemplateController).getVersion(id, version), 200);
});

/** Field caps bound characters, not bytes, so a body with every field at its cap can exceed the default limit once JSON-escaped. */
const MAX_TEMPLATE_WRITE_BODY_BYTES = 1024 * 1024;

const RATE_LIMITED_DESCRIPTION = "The caller or the organization reached a limit; `Retry-After` tells when to try again (`template_rate_limited`)";

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
    404: {
      description: "The project does not exist, or the template copied from does not exist or the caller may not read it (`template_copy_source_not_found`)"
    },
    410: { description: "The template copied from was public once and has since been removed (`template_removed`, with the `title` it had)" },
    429: { description: RATE_LIMITED_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(createUserTemplateRoute, async function routeCreateUserTemplate(c) {
  return c.json(await container.resolve(MarketplaceTemplateController).createTemplate(c.req.valid("json")), 201);
});

const createUserTemplateVersionRoute = createRoute({
  method: "post",
  operationId: "createUserTemplateVersion",
  path: "/v1/user-templates/{id}/versions",
  summary: "Save a new version of a template the caller may change, held to the publish checks when the template is public",
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
      description: "The version saved; with status `failed_checks` it did not become the current version, and `checkResults` says why",
      content: { "application/json": { schema: CreateUserTemplateVersionResponseSchema } }
    },
    400: { description: TEMPLATE_INVALID_DESCRIPTION },
    401: { description: "The caller is not signed in" },
    403: { description: "The caller may read the template but not change it" },
    404: { description: NOT_FOUND_DESCRIPTION },
    409: { description: "Another version was saved after the base version (`template_version_conflict`)" },
    429: { description: RATE_LIMITED_DESCRIPTION }
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
    400: {
      description:
        "The body changes no setting, a setting is outside the catalog or its limits, or the new title of a public template uses a reserved word (`template_publish_checks_failed`)"
    },
    401: { description: "The caller is not signed in" },
    403: { description: OUTSIDE_ORGANIZATION_DESCRIPTION },
    404: { description: NOT_FOUND_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(updateUserTemplateRoute, async function routeUpdateUserTemplate(c) {
  const { id } = c.req.valid("param");
  return c.json(await container.resolve(MarketplaceTemplateController).updateTemplate(id, c.req.valid("json")), 200);
});

const getUserTemplatePublishReadinessRoute = createRoute({
  method: "get",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "getUserTemplatePublishReadiness",
  path: "/v1/user-templates/{id}/publish-readiness",
  summary: "Tell what still stands between a template the caller may change and making it public",
  tags: ["Templates"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  request: {
    params: UserTemplateParamsSchema
  },
  responses: {
    200: {
      description: "The requirements on the caller and the organization, and the publish checks run on the current version",
      content: { "application/json": { schema: GetPublishReadinessResponseSchema } }
    },
    400: { description: "The id is not a uuid" },
    401: { description: "The caller is not signed in" },
    403: { description: OUTSIDE_ORGANIZATION_DESCRIPTION },
    404: { description: NOT_FOUND_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(getUserTemplatePublishReadinessRoute, async function routeGetUserTemplatePublishReadiness(c) {
  const { id } = c.req.valid("param");
  return c.json(await container.resolve(MarketplaceTemplateController).getPublishReadiness(id), 200);
});

const publishUserTemplateRoute = createRoute({
  method: "post",
  operationId: "publishUserTemplate",
  path: "/v1/user-templates/{id}/publish",
  summary: "Make a template public and list it in the gallery, once its requirements are met and its checks pass",
  tags: ["Templates"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  request: {
    params: UserTemplateParamsSchema,
    body: { content: { "application/json": { schema: PublishUserTemplateRequestSchema } }, required: true }
  },
  responses: {
    200: {
      description: "The template, now public",
      content: { "application/json": { schema: PublishUserTemplateResponseSchema } }
    },
    400: { description: "The body is invalid, or the current version fails the publish checks (`template_publish_checks_failed`, with the `checks`)" },
    401: { description: "The caller is not signed in" },
    403: {
      description: `A requirement is unmet (\`template_publish_requirements_unmet\`, with the \`unmet\` keys). ${OUTSIDE_ORGANIZATION_DESCRIPTION}`
    },
    404: { description: NOT_FOUND_DESCRIPTION },
    409: { description: "The terms accepted are not the current ones (`template_terms_version_mismatch`, with the current `termsVersion`)" },
    429: { description: RATE_LIMITED_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(publishUserTemplateRoute, async function routePublishUserTemplate(c) {
  const { id } = c.req.valid("param");
  return c.json(await container.resolve(MarketplaceTemplateController).publishTemplate(id, c.req.valid("json")), 200);
});

const createUserTemplateReportRoute = createRoute({
  method: "post",
  operationId: "createUserTemplateReport",
  path: "/v1/user-templates/{id}/reports",
  summary: "Report the current version of a public template to Akash staff, without the publisher learning who did",
  tags: ["Templates"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  request: {
    params: UserTemplateParamsSchema,
    body: { content: { "application/json": { schema: CreateTemplateReportRequestSchema } }, required: true }
  },
  responses: {
    201: {
      description: "The report filed",
      content: { "application/json": { schema: CreateTemplateReportResponseSchema } }
    },
    400: { description: "The id is not a uuid, the reason is unknown, or the details are too long or not readable text" },
    401: { description: "The caller is not signed in" },
    403: { description: "The caller belongs to the organization that published the template (`template_report_own_organization`)" },
    404: { description: NOT_FOUND_DESCRIPTION },
    409: {
      description:
        "The caller already reported this version (`template_already_reported`), or the template is not public, is hidden or has no version (`template_not_reportable`)"
    },
    410: { description: REMOVED_DESCRIPTION },
    429: { description: RATE_LIMITED_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(createUserTemplateReportRoute, async function routeCreateUserTemplateReport(c) {
  const { id } = c.req.valid("param");
  return c.json(await container.resolve(MarketplaceTemplateController).reportTemplate(id, c.req.valid("json")), 201);
});

const createUserTemplateViewRoute = createRoute({
  method: "post",
  operationId: "createUserTemplateView",
  path: "/v1/user-templates/{id}/views",
  summary: "Count a signed-in user's view of a template's page, or their open of Configure from it, once a day",
  description: "Members of the organization that publishes a public template are not counted.",
  tags: ["Templates"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  request: {
    params: UserTemplateParamsSchema,
    body: { content: { "application/json": { schema: CreateTemplateViewRequestSchema } }, required: true }
  },
  responses: {
    204: { description: "The view counted, already counted today, or not counted for this viewer" },
    400: { description: "The id is not a uuid, or the kind is unknown" },
    401: { description: "The caller is not signed in" },
    404: { description: NOT_FOUND_DESCRIPTION },
    410: { description: REMOVED_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(createUserTemplateViewRoute, async function routeCreateUserTemplateView(c) {
  const { id } = c.req.valid("param");
  await container.resolve(MarketplaceTemplateController).recordView(id, c.req.valid("json"));
  return c.body(null, 204);
});

const getUserTemplateInsightsRoute = createRoute({
  method: "get",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "getUserTemplateInsights",
  path: "/v1/user-templates/{id}/insights",
  summary: "Tell how a template the caller may change is used: views, deployments and how they fared, by day and by version, with hints",
  tags: ["Templates"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  request: {
    params: UserTemplateParamsSchema,
    query: GetTemplateInsightsQuerySchema
  },
  responses: {
    200: {
      description: "The insights, counted on mainnet and without a public template's own organization",
      content: { "application/json": { schema: GetTemplateInsightsResponseSchema } }
    },
    400: { description: "The id is not a uuid, or the number of days is not 7, 30 or 90" },
    401: { description: "The caller is not signed in" },
    403: { description: OUTSIDE_ORGANIZATION_DESCRIPTION },
    404: { description: NOT_FOUND_DESCRIPTION },
    410: { description: REMOVED_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(getUserTemplateInsightsRoute, async function routeGetUserTemplateInsights(c) {
  const { id } = c.req.valid("param");
  return c.json(await container.resolve(MarketplaceTemplateController).getInsights(id, c.req.valid("query")), 200);
});

const deleteUserTemplateRoute = createRoute({
  method: "delete",
  operationId: "deleteUserTemplate",
  path: "/v1/user-templates/{id}",
  summary: "Delete a template the caller may delete; one that was ever public keeps its link as a removed page",
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
    404: { description: NOT_FOUND_DESCRIPTION },
    410: { description: REMOVED_DESCRIPTION }
  }
});

marketplaceTemplatesRouter.openapi(deleteUserTemplateRoute, async function routeDeleteUserTemplate(c) {
  const { id } = c.req.valid("param");
  await container.resolve(MarketplaceTemplateController).deleteTemplate(id);
  return c.body(null, 204);
});
