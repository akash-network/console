import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER } from "@src/core/services/openapi-docs/openapi-security";
import { AssistantPrivacyController } from "../controllers/assistant-privacy/assistant-privacy.controller";
import {
  AssistantPrivacyResponseSchema,
  DeleteAssistantConversationsResponseSchema,
  UpdateAssistantConsentRequestSchema
} from "../http-schemas/assistant-privacy.schema";

export const assistantPrivacyRouter = new OpenApiHonoHandler();

const UNAUTHORIZED = { description: "Unauthorized" };

const getAssistantConsentRoute = createRoute({
  method: "get",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "getAssistantConsent",
  path: "/v1/assistant/consent",
  summary: "Get the user's consent to the assistant and how many of their conversations are stored",
  tags: ["Assistant"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.USER_FEEDBACK_LOOP,
  responses: {
    200: { description: "The latest consent and the stored conversation count", content: { "application/json": { schema: AssistantPrivacyResponseSchema } } },
    401: UNAUTHORIZED
  }
});

assistantPrivacyRouter.openapi(getAssistantConsentRoute, async function routeGetAssistantConsent(c) {
  return c.json(await container.resolve(AssistantPrivacyController).getConsent(), 200);
});

const updateAssistantConsentRoute = createRoute({
  method: "put",
  operationId: "updateAssistantConsent",
  path: "/v1/assistant/consent",
  summary: "Record the user's agreement to the assistant and whether the Akash team may review their conversations",
  tags: ["Assistant"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.USER_FEEDBACK_LOOP,
  request: {
    body: { required: true, content: { "application/json": { schema: UpdateAssistantConsentRequestSchema } } }
  },
  responses: {
    200: { description: "The consent as now recorded", content: { "application/json": { schema: AssistantPrivacyResponseSchema } } },
    400: { description: "Invalid request body" },
    401: UNAUTHORIZED
  }
});

assistantPrivacyRouter.openapi(updateAssistantConsentRoute, async function routeUpdateAssistantConsent(c) {
  const { data } = c.req.valid("json");
  return c.json(await container.resolve(AssistantPrivacyController).updateConsent(data), 200);
});

const deleteAssistantConversationsRoute = createRoute({
  method: "delete",
  operationId: "deleteAssistantConversations",
  path: "/v1/assistant/conversations",
  summary: "Delete every assistant conversation stored for the user, along with their quotes in feedback themes",
  tags: ["Assistant"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.USER_FEEDBACK_LOOP,
  responses: {
    200: { description: "How many conversations were deleted", content: { "application/json": { schema: DeleteAssistantConversationsResponseSchema } } },
    401: UNAUTHORIZED
  }
});

assistantPrivacyRouter.openapi(deleteAssistantConversationsRoute, async function routeDeleteAssistantConversations(c) {
  return c.json(await container.resolve(AssistantPrivacyController).deleteConversations(), 200);
});
