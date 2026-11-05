import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER } from "@src/core/services/openapi-docs/openapi-security";
import { AssistantConversationController } from "../controllers/assistant-conversation/assistant-conversation.controller";
import {
  AssistantStreamEventSchema,
  ConversationIdParamsSchema,
  EndAssistantConversationRequestSchema,
  EndAssistantConversationResponseSchema,
  RecordAssistantActionResultRequestSchema,
  RecordAssistantActionResultResponseSchema,
  SendAssistantMessageRequestSchema,
  StartAssistantConversationRequestSchema,
  StartAssistantConversationResponseSchema,
  SubmitClientToolResultsRequestSchema
} from "../http-schemas/assistant-conversation.schema";
import { streamAssistantTurn } from "../lib/assistant-stream/assistant-stream";

export const assistantConversationRouter = new OpenApiHonoHandler();

const UNAUTHORIZED = { description: "Unauthorized" };
const CONSENT_REQUIRED = {
  description:
    "`assistant_consent_required` when the user never agreed to the assistant. `assistant_consent_outdated` when the copy version differs from the one agreed to"
};
const UNAVAILABLE = { description: "`assistant_unavailable`: the assistant is off or over its budget. Point the user to Discord" };
const RATE_LIMITED = { description: "`assistant_rate_limited` (too many messages this minute) or `assistant_daily_limit` (too many today)" };
const EVENT_STREAM = {
  description:
    "A server-sent event stream of the assistant turn. Each event's `event` field is its `type`, and its `data` is the event as JSON. The stream ends after `done` or `error`.",
  content: { "text/event-stream": { schema: AssistantStreamEventSchema } }
};

const startAssistantConversationRoute = createRoute({
  method: "post",

  operationId: "createAssistantConversation",
  path: "/v1/assistant/conversations",
  summary: "Start an assistant conversation",
  tags: ["Assistant"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.USER_FEEDBACK_LOOP,
  request: { body: { required: true, content: { "application/json": { schema: StartAssistantConversationRequestSchema } } } },
  responses: {
    201: {
      description: "The conversation, and whether the API stores it",
      content: { "application/json": { schema: StartAssistantConversationResponseSchema } }
    },
    400: { description: "Invalid request body" },
    401: UNAUTHORIZED,
    409: CONSENT_REQUIRED
  }
});

assistantConversationRouter.openapi(startAssistantConversationRoute, async function routeStartAssistantConversation(c) {
  const { data } = c.req.valid("json");
  return c.json(await container.resolve(AssistantConversationController).start(data), 201);
});

const sendAssistantMessageRoute = createRoute({
  method: "post",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "sendAssistantMessage",
  path: "/v1/assistant/conversations/{id}/messages",
  summary: "Send a message to the assistant and stream its answer",
  tags: ["Assistant"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.USER_FEEDBACK_LOOP,
  request: {
    params: ConversationIdParamsSchema,
    body: { required: true, content: { "application/json": { schema: SendAssistantMessageRequestSchema } } }
  },
  responses: {
    200: EVENT_STREAM,
    400: { description: "Invalid request body" },
    401: UNAUTHORIZED,
    409: { description: `${CONSENT_REQUIRED.description}. \`assistant_conversation_ended\` when the conversation already ended` },
    429: RATE_LIMITED,
    503: UNAVAILABLE
  }
});

assistantConversationRouter.openapi(sendAssistantMessageRoute, async function routeSendAssistantMessage(c) {
  const { id } = c.req.valid("param");
  const { data } = c.req.valid("json");
  const run = await container.resolve(AssistantConversationController).sendMessage(id, data);
  return streamAssistantTurn(c, run);
});

const submitClientToolResultsRoute = createRoute({
  method: "post",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "submitAssistantClientToolResults",
  path: "/v1/assistant/conversations/{id}/client-tool-results",
  summary: "Return what the browser read for the assistant and stream the rest of the turn",
  tags: ["Assistant"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.USER_FEEDBACK_LOOP,
  request: {
    params: ConversationIdParamsSchema,
    body: { required: true, content: { "application/json": { schema: SubmitClientToolResultsRequestSchema } } }
  },
  responses: {
    200: EVENT_STREAM,
    400: { description: "Invalid request body, or `assistant_tool_results_mismatch` when the results do not answer each requested call exactly once" },
    401: UNAUTHORIZED,
    409: { description: `${CONSENT_REQUIRED.description}. \`assistant_no_pending_tool_request\` when no turn waits on the browser, or it expired` },
    503: UNAVAILABLE
  }
});

assistantConversationRouter.openapi(submitClientToolResultsRoute, async function routeSubmitClientToolResults(c) {
  const { id } = c.req.valid("param");
  const { data } = c.req.valid("json");
  const run = await container.resolve(AssistantConversationController).submitClientToolResults(id, data);
  return streamAssistantTurn(c, run);
});

const endAssistantConversationRoute = createRoute({
  method: "post",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "endAssistantConversation",
  path: "/v1/assistant/conversations/{id}/end",
  summary: "End an assistant conversation and say whether it helped",
  tags: ["Assistant"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.USER_FEEDBACK_LOOP,
  request: {
    params: ConversationIdParamsSchema,
    body: { required: true, content: { "application/json": { schema: EndAssistantConversationRequestSchema } } }
  },
  responses: {
    200: { description: "How the conversation ended", content: { "application/json": { schema: EndAssistantConversationResponseSchema } } },
    400: { description: "Invalid request body" },
    401: UNAUTHORIZED
  }
});

assistantConversationRouter.openapi(endAssistantConversationRoute, async function routeEndAssistantConversation(c) {
  const { id } = c.req.valid("param");
  const { data } = c.req.valid("json");
  return c.json(await container.resolve(AssistantConversationController).end(id, data), 200);
});

const recordAssistantActionResultRoute = createRoute({
  method: "post",

  operationId: "createAssistantActionResult",
  path: "/v1/assistant/conversations/{id}/action-results",
  summary: "Record whether the user confirmed a proposed action, and how it ended",
  tags: ["Assistant"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.USER_FEEDBACK_LOOP,
  request: {
    params: ConversationIdParamsSchema,
    body: { required: true, content: { "application/json": { schema: RecordAssistantActionResultRequestSchema } } }
  },
  responses: {
    200: { description: "Whether the result was stored", content: { "application/json": { schema: RecordAssistantActionResultResponseSchema } } },
    400: { description: "Invalid request body" },
    401: UNAUTHORIZED,
    404: { description: "`assistant_proposal_not_found` when the stored conversation holds no such proposal" }
  }
});

assistantConversationRouter.openapi(recordAssistantActionResultRoute, async function routeRecordAssistantActionResult(c) {
  const { id } = c.req.valid("param");
  const { data } = c.req.valid("json");
  return c.json(await container.resolve(AssistantConversationController).recordActionResult(id, data), 200);
});
