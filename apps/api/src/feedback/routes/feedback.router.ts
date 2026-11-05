import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER } from "@src/core/services/openapi-docs/openapi-security";
import { FeedbackController } from "../controllers/feedback/feedback.controller";
import {
  CreateFeedbackRequestSchema,
  CreateFeedbackResponseSchema,
  FeedbackOutcomePromptParamsSchema,
  FeedbackOutcomePromptResponseSchema
} from "../http-schemas/feedback.schema";

export const feedbackRouter = new OpenApiHonoHandler();

const createFeedbackRoute = createRoute({
  method: "post",
  operationId: "createFeedback",
  path: "/v1/feedback",
  summary: "Send a deployment outcome rating or general feedback to the Akash team",
  tags: ["Feedback"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.USER_FEEDBACK_LOOP,
  bodyLimit: { maxSize: 32 * 1024 },
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateFeedbackRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "The feedback was recorded",
      content: {
        "application/json": {
          schema: CreateFeedbackResponseSchema
        }
      }
    },
    400: { description: "Invalid request body" },
    401: { description: "Unauthorized" },
    409: { description: "The outcome prompt of this deployment was already answered (`feedback_already_answered`)" },
    429: { description: "Too much feedback sent recently (`feedback_limit`)" }
  }
});

feedbackRouter.openapi(createFeedbackRoute, async function routeCreateFeedback(c) {
  const { data } = c.req.valid("json");
  return c.json(await container.resolve(FeedbackController).create(data), 201);
});

const getFeedbackOutcomePromptRoute = createRoute({
  method: "get",
  operationId: "getFeedbackOutcomePrompt",
  path: "/v1/feedback/outcome-prompts/{dseq}",
  summary: "Tell whether to ask the user how a deployment went",
  tags: ["Feedback"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.USER_FEEDBACK_LOOP,
  request: {
    params: FeedbackOutcomePromptParamsSchema
  },
  responses: {
    200: {
      description: "Whether the outcome prompt should be shown for this deployment",
      content: {
        "application/json": {
          schema: FeedbackOutcomePromptResponseSchema
        }
      }
    },
    400: { description: "Invalid dseq" },
    401: { description: "Unauthorized" }
  }
});

feedbackRouter.openapi(getFeedbackOutcomePromptRoute, async function routeGetFeedbackOutcomePrompt(c) {
  const { dseq } = c.req.valid("param");
  return c.json(await container.resolve(FeedbackController).getOutcomePrompt(dseq), 200);
});
