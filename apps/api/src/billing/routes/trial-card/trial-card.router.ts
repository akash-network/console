import { container } from "tsyringe";

import { TrialCardController } from "@src/billing/controllers/trial-card/trial-card.controller";
import { ConfirmTrialCardRequestSchema, TrialCardResponseSchema, TrialCardSetupIntentResponseSchema } from "@src/billing/http-schemas/trial-card.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const trialCardRouter = new OpenApiHonoHandler();

const getTrialCardRoute = createRoute({
  method: "get",
  path: "/v1/trial-card",
  summary: "Tell whether the caller's free trial waits for a card",
  // eslint-disable-next-line akash/operation-id-format
  operationId: "getTrialCard",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  hiddenInOpenApiDocs: true,
  request: {},
  responses: {
    200: {
      description: "Where the caller stands with the card step of the free trial",
      content: { "application/json": { schema: TrialCardResponseSchema } }
    },
    401: { description: "Unauthorized" }
  }
});

trialCardRouter.openapi(getTrialCardRoute, async function routeGetTrialCard(c) {
  return c.json(await container.resolve(TrialCardController).getTrialCard(), 200);
});

const createTrialCardSetupIntentRoute = createRoute({
  method: "post",
  path: "/v1/trial-card/setup-intents",
  summary: "Create the Stripe SetupIntent a card is saved with to start the free trial",
  operationId: "createTrialCardSetupIntent",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  hiddenInOpenApiDocs: true,
  request: {},
  responses: {
    200: {
      description: "SetupIntent created, limited to cards and asking the issuer for 3D Secure",
      content: { "application/json": { schema: TrialCardSetupIntentResponseSchema } }
    },
    401: { description: "Unauthorized" },
    404: { description: "The card step is switched off" }
  }
});

trialCardRouter.openapi(createTrialCardSetupIntentRoute, async function routeCreateTrialCardSetupIntent(c) {
  return c.json(await container.resolve(TrialCardController).createSetupIntent(), 200);
});

const confirmTrialCardRoute = createRoute({
  method: "post",
  path: "/v1/trial-card/confirm",
  summary: "Start the free trial with the card a SetupIntent saved",
  operationId: "confirmTrialCard",
  tags: ["Payment"],
  security: SECURITY_BEARER_OR_API_KEY,
  hiddenInOpenApiDocs: true,
  request: {
    body: { content: { "application/json": { schema: ConfirmTrialCardRequestSchema } } }
  },
  responses: {
    200: {
      description: "The card is verified and the trial is being started",
      content: { "application/json": { schema: TrialCardResponseSchema } }
    },
    401: { description: "Unauthorized" },
    403: { description: "The caller's email is not confirmed yet (`email_verification_required`)" },
    404: { description: "The card step is switched off, or the SetupIntent is not the caller's" },
    422: {
      description:
        "The card cannot start a trial: `trial_card_not_verified`, `trial_card_unsupported`, `trial_card_prepaid` or `trial_card_already_used`. The caller can still add credits"
    }
  }
});

trialCardRouter.openapi(confirmTrialCardRoute, async function routeConfirmTrialCard(c) {
  return c.json(await container.resolve(TrialCardController).confirm(c.req.valid("json")), 200);
});
