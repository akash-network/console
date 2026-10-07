import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { ConfigureDraftController } from "@src/deployment/controllers/configure-draft/configure-draft.controller";
import {
  CONFIGURE_DRAFT_BODY_LIMIT_BYTES,
  ConfigureDraftParamsSchema,
  ConfigureDraftResponseSchema,
  UpdateConfigureDraftRequestSchema
} from "@src/deployment/http-schemas/configure-draft.schema";

export const configureDraftsRouter = new OpenApiHonoHandler();

const configureDraftResponse = {
  description: "The draft as the account holds it",
  content: { "application/json": { schema: ConfigureDraftResponseSchema } }
};

const getConfigureDraftRoute = createRoute({
  method: "get",
  path: "/v1/configure-drafts/{draftId}",
  operationId: "getConfigureDraft",
  summary: "Read an unfinished deployment configuration the user saved",
  tags: ["Deployments"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: { params: ConfigureDraftParamsSchema },
  responses: {
    200: configureDraftResponse,
    400: { description: "Invalid draft id" },
    401: { description: "Unauthorized" },
    404: { description: "The user has no such draft, or it expired" }
  }
});

configureDraftsRouter.openapi(getConfigureDraftRoute, async function routeGetConfigureDraft(c) {
  const { draftId } = c.req.valid("param");
  return c.json(await container.resolve(ConfigureDraftController).get(draftId), 200);
});

const updateConfigureDraftRoute = createRoute({
  method: "put",
  path: "/v1/configure-drafts/{draftId}",
  operationId: "updateConfigureDraft",
  summary: "Save an unfinished deployment configuration, creating the draft or replacing it",
  description:
    "A user keeps at most 20 drafts: saving a new one drops the least recently saved. A draft expires 30 days after it was last saved. Secret values never belong in a draft, only the references the SDL carries.",
  tags: ["Deployments"],
  security: SECURITY_BEARER_OR_API_KEY,
  bodyLimit: { maxSize: CONFIGURE_DRAFT_BODY_LIMIT_BYTES },
  request: {
    params: ConfigureDraftParamsSchema,
    body: { required: true, content: { "application/json": { schema: UpdateConfigureDraftRequestSchema } } }
  },
  responses: {
    200: configureDraftResponse,
    400: { description: "Invalid draft id or body" },
    401: { description: "Unauthorized" }
  }
});

configureDraftsRouter.openapi(updateConfigureDraftRoute, async function routeUpdateConfigureDraft(c) {
  const { draftId } = c.req.valid("param");
  const { data } = c.req.valid("json");
  return c.json(await container.resolve(ConfigureDraftController).save(draftId, data), 200);
});

const deleteConfigureDraftRoute = createRoute({
  method: "delete",
  path: "/v1/configure-drafts/{draftId}",
  operationId: "deleteConfigureDraft",
  summary: "Discard a saved deployment configuration",
  tags: ["Deployments"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: { params: ConfigureDraftParamsSchema },
  responses: {
    204: { description: "The draft is gone, or there was none" },
    400: { description: "Invalid draft id" },
    401: { description: "Unauthorized" }
  }
});

configureDraftsRouter.openapi(deleteConfigureDraftRoute, async function routeDeleteConfigureDraft(c) {
  const { draftId } = c.req.valid("param");
  await container.resolve(ConfigureDraftController).delete(draftId);
  return c.body(null, 204);
});
