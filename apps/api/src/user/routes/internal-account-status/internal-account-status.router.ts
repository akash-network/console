import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { requireInternalToken } from "@src/middlewares/internal-token/internal-token.middleware";
import { AccountStatusController } from "@src/user/controllers/account-status/account-status.controller";
import {
  AccountStatusEventListResponseSchema,
  AccountStatusEventResponseSchema,
  AccountStatusUserParamsSchema,
  ReinstateAccountRequestSchema,
  SuspendAccountRequestSchema
} from "@src/user/http-schemas/account-status.schema";

export const internalAccountStatusRouter = new OpenApiHonoHandler();

const TRANSITION_RESPONSES = {
  200: { description: "The recorded account status event", content: { "application/json": { schema: AccountStatusEventResponseSchema } } },
  400: { description: "Invalid body" },
  401: { description: "Missing or wrong internal token" },
  404: { description: "No user has this id" },
  409: { description: "The account's current status does not allow this change" }
} as const;

const suspendRoute = createRoute({
  method: "post",
  path: "/v1/users/{userId}/suspend",
  operationId: "suspendUserAccount",
  summary: "Suspend an active account so it can no longer spend, optionally closing its deployments",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: {
    params: AccountStatusUserParamsSchema,
    body: { required: true, content: { "application/json": { schema: SuspendAccountRequestSchema } } }
  },
  responses: TRANSITION_RESPONSES
});

internalAccountStatusRouter.openapi(suspendRoute, async function routeSuspendUserAccount(c) {
  return c.json(await container.resolve(AccountStatusController).suspend(c.req.valid("param").userId, c.req.valid("json")), 200);
});

const reinstateRoute = createRoute({
  method: "post",
  path: "/v1/users/{userId}/reinstate",
  operationId: "reinstateUserAccount",
  summary: "Reinstate a suspended account",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: {
    params: AccountStatusUserParamsSchema,
    body: { required: true, content: { "application/json": { schema: ReinstateAccountRequestSchema } } }
  },
  responses: TRANSITION_RESPONSES
});

internalAccountStatusRouter.openapi(reinstateRoute, async function routeReinstateUserAccount(c) {
  return c.json(await container.resolve(AccountStatusController).reinstate(c.req.valid("param").userId, c.req.valid("json")), 200);
});

const listEventsRoute = createRoute({
  method: "get",
  path: "/v1/users/{userId}/account-status-events",
  operationId: "listUserAccountStatusEvents",
  summary: "Every account status change of a user, newest first",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: { params: AccountStatusUserParamsSchema },
  responses: {
    200: { description: "The user's account status events, newest first", content: { "application/json": { schema: AccountStatusEventListResponseSchema } } },
    400: { description: "Invalid user id" },
    401: { description: "Missing or wrong internal token" }
  }
});

internalAccountStatusRouter.openapi(listEventsRoute, async function routeListUserAccountStatusEvents(c) {
  return c.json(await container.resolve(AccountStatusController).listEvents(c.req.valid("param").userId), 200);
});
