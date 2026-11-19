import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY, SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { CommunityTemplateController } from "@src/template-marketplace/controllers/community-template/community-template.controller";
import {
  GetCurrentTemplatePublisherResponseSchema,
  GetTemplatePublisherResponseSchema,
  ListCommunityTemplatesResponseSchema,
  TemplatePublisherParamsSchema,
  UpdateCurrentTemplatePublisherRequestSchema
} from "@src/template-marketplace/http-schemas/community-template.schema";
import { GALLERY_CACHE_SECONDS, MAX_LISTED_COMMUNITY_TEMPLATES } from "@src/template-marketplace/services/community-template/community-template.service";
import { PUBLISHER_PAGE_CACHE_SECONDS } from "@src/template-marketplace/services/template-publisher/template-publisher.service";

export const communityTemplatesRouter = new OpenApiHonoHandler();

const NOT_A_PUBLISHER_DESCRIPTION = "The active organization has not published a template yet";

const listCommunityTemplatesRoute = createRoute({
  method: "get",
  operationId: "listCommunityTemplates",
  path: "/v1/community-templates",
  summary: "List the public templates of the gallery, newest first, with how much each is used",
  tags: ["Templates"],
  security: SECURITY_NONE,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  cache: { maxAge: GALLERY_CACHE_SECONDS, staleWhileRevalidate: 2 * GALLERY_CACHE_SECONDS },
  responses: {
    200: {
      description: `At most ${MAX_LISTED_COMMUNITY_TEMPLATES} templates, the same for every caller`,
      content: { "application/json": { schema: ListCommunityTemplatesResponseSchema } }
    }
  }
});

communityTemplatesRouter.openapi(listCommunityTemplatesRoute, async function routeListCommunityTemplates(c) {
  return c.json(await container.resolve(CommunityTemplateController).listTemplates(), 200);
});

/** Registered before the route by handle, which would otherwise read `current` as a publisher's handle. */
const getCurrentTemplatePublisherRoute = createRoute({
  method: "get",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "getCurrentTemplatePublisher",
  path: "/v1/template-publishers/current",
  summary: "Get the publisher profile of the active organization",
  tags: ["Templates"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  responses: {
    200: {
      description: "The profile, and whether the caller may change it",
      content: { "application/json": { schema: GetCurrentTemplatePublisherResponseSchema } }
    },
    401: { description: "The caller is not signed in" },
    404: { description: NOT_A_PUBLISHER_DESCRIPTION }
  }
});

communityTemplatesRouter.openapi(getCurrentTemplatePublisherRoute, async function routeGetCurrentTemplatePublisher(c) {
  return c.json(await container.resolve(CommunityTemplateController).getCurrentPublisher(), 200);
});

const getTemplatePublisherRoute = createRoute({
  method: "get",
  operationId: "getTemplatePublisher",
  path: "/v1/template-publishers/{handle}",
  summary: "Get a publisher's public page: who it is and the templates it lists in the gallery",
  tags: ["Templates"],
  security: SECURITY_NONE,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  cache: { maxAge: PUBLISHER_PAGE_CACHE_SECONDS, staleWhileRevalidate: 2 * PUBLISHER_PAGE_CACHE_SECONDS },
  request: {
    params: TemplatePublisherParamsSchema
  },
  responses: {
    200: {
      description: "The publisher page, the same for every caller",
      content: { "application/json": { schema: GetTemplatePublisherResponseSchema } }
    },
    400: { description: "The handle is not one a publisher can have" },
    404: { description: "No publisher has this handle, or its publishing is suspended" }
  }
});

communityTemplatesRouter.openapi(getTemplatePublisherRoute, async function routeGetTemplatePublisher(c) {
  const { handle } = c.req.valid("param");
  return c.json(await container.resolve(CommunityTemplateController).getPublisher(handle), 200);
});

const updateCurrentTemplatePublisherRoute = createRoute({
  method: "patch",
  operationId: "updateCurrentTemplatePublisher",
  path: "/v1/template-publishers/current",
  summary: "Change the bio and the links on the publisher page of the active organization",
  tags: ["Templates"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.TEMPLATE_MARKETPLACE,
  request: {
    body: { content: { "application/json": { schema: UpdateCurrentTemplatePublisherRequestSchema } }, required: true }
  },
  responses: {
    200: {
      description: "The profile changed",
      content: { "application/json": { schema: GetCurrentTemplatePublisherResponseSchema } }
    },
    400: { description: "The body changes nothing, the bio is too long or not readable text, or a link is not an https link to a public website" },
    401: { description: "The caller is not signed in" },
    403: { description: "The caller is not an owner or an admin of the active organization" },
    404: { description: NOT_A_PUBLISHER_DESCRIPTION }
  }
});

communityTemplatesRouter.openapi(updateCurrentTemplatePublisherRoute, async function routeUpdateCurrentTemplatePublisher(c) {
  return c.json(await container.resolve(CommunityTemplateController).updateCurrentPublisher(c.req.valid("json")), 200);
});
