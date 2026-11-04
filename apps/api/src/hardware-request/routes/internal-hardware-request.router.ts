import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { HardwareRequestBrokerController } from "@src/hardware-request/controllers/hardware-request-broker/hardware-request-broker.controller";
import {
  AddHardwareRequestNoteRequestSchema,
  AssignHardwareRequestOwnerRequestSchema,
  HardwareRequestIdParamsSchema,
  HardwareRequestQueueQuerySchema,
  HardwareRequestQueueResponseSchema,
  HardwareRequestWithTimelineResponseSchema,
  SwitchHardwareRequestLaneRequestSchema
} from "@src/hardware-request/http-schemas/hardware-request-broker.schema";
import { requireInternalToken } from "@src/middlewares/internal-token/internal-token.middleware";

export const internalHardwareRequestRouter = new OpenApiHonoHandler();

const listQueueRoute = createRoute({
  method: "get",
  path: "/hardware-requests",
  operationId: "listHardwareRequestQueue",
  summary: "The team's queue of GPU requests across every organization",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: { query: HardwareRequestQueueQuerySchema },
  responses: {
    200: { description: "The requests matching the filters", content: { "application/json": { schema: HardwareRequestQueueResponseSchema } } },
    400: { description: "Invalid filters" },
    401: { description: "Missing or wrong internal token" }
  }
});

internalHardwareRequestRouter.openapi(listQueueRoute, async function routeListHardwareRequestQueue(c) {
  return c.json(await container.resolve(HardwareRequestBrokerController).listQueue(c.req.valid("query")), 200);
});

const getRoute = createRoute({
  method: "get",
  path: "/hardware-requests/{id}",
  operationId: "getHardwareRequestWithTimeline",
  summary: "One GPU request with its timeline, for the team",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: { params: HardwareRequestIdParamsSchema },
  responses: {
    200: { description: "The request and its events, oldest first", content: { "application/json": { schema: HardwareRequestWithTimelineResponseSchema } } },
    401: { description: "Missing or wrong internal token" },
    404: { description: "No request has this id" }
  }
});

internalHardwareRequestRouter.openapi(getRoute, async function routeGetHardwareRequestWithTimeline(c) {
  return c.json(await container.resolve(HardwareRequestBrokerController).get(c.req.valid("param").id), 200);
});

const ACTION_RESPONSES = {
  200: { description: "The request and its timeline after the change", content: { "application/json": { schema: HardwareRequestWithTimelineResponseSchema } } },
  400: { description: "Invalid body" },
  401: { description: "Missing or wrong internal token" },
  404: { description: "No request has this id" }
} as const;

const updateOwnerRoute = createRoute({
  method: "put",
  path: "/hardware-requests/{id}/owner",
  operationId: "updateHardwareRequestOwner",
  summary: "Claim, reassign or release a GPU request",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: {
    params: HardwareRequestIdParamsSchema,
    body: { required: true, content: { "application/json": { schema: AssignHardwareRequestOwnerRequestSchema } } }
  },
  responses: ACTION_RESPONSES
});

internalHardwareRequestRouter.openapi(updateOwnerRoute, async function routeUpdateHardwareRequestOwner(c) {
  return c.json(await container.resolve(HardwareRequestBrokerController).assignOwner(c.req.valid("param").id, c.req.valid("json")), 200);
});

const updateLaneRoute = createRoute({
  method: "put",
  path: "/hardware-requests/{id}/lane",
  operationId: "updateHardwareRequestLane",
  summary: "Move a GPU request to the other lane by hand",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: {
    params: HardwareRequestIdParamsSchema,
    body: { required: true, content: { "application/json": { schema: SwitchHardwareRequestLaneRequestSchema } } }
  },
  responses: ACTION_RESPONSES
});

internalHardwareRequestRouter.openapi(updateLaneRoute, async function routeUpdateHardwareRequestLane(c) {
  return c.json(await container.resolve(HardwareRequestBrokerController).switchLane(c.req.valid("param").id, c.req.valid("json")), 200);
});

const createNoteRoute = createRoute({
  method: "post",
  path: "/hardware-requests/{id}/notes",
  operationId: "createHardwareRequestNote",
  summary: "Add an internal note to a GPU request, never shown to the tenant",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: {
    params: HardwareRequestIdParamsSchema,
    body: { required: true, content: { "application/json": { schema: AddHardwareRequestNoteRequestSchema } } }
  },
  responses: ACTION_RESPONSES
});

internalHardwareRequestRouter.openapi(createNoteRoute, async function routeCreateHardwareRequestNote(c) {
  return c.json(await container.resolve(HardwareRequestBrokerController).addNote(c.req.valid("param").id, c.req.valid("json")), 200);
});
