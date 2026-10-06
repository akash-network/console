import { container } from "tsyringe";

import { ActivityController } from "@src/activity/controllers/activity/activity.controller";
import {
  GetActivityParamsSchema,
  GetActivityResponseSchema,
  ListActivitiesQuerySchema,
  ListActivitiesResponseSchema,
  MarkActivitiesSeenRequestSchema,
  MarkActivitiesSeenResponseSchema
} from "@src/activity/http-schemas/activity.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const activityRouter = new OpenApiHonoHandler();

const listActivitiesRoute = createRoute({
  method: "get",
  path: "/v1/activities",
  operationId: "listActivities",
  summary: "List the user's recent actions and their outcomes, newest first, with how many are still unseen",
  tags: ["Activities"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: { query: ListActivitiesQuerySchema },
  responses: {
    200: { description: "One page of activities", content: { "application/json": { schema: ListActivitiesResponseSchema } } },
    400: { description: "Invalid query or cursor" },
    401: { description: "Unauthorized" }
  }
});

activityRouter.openapi(listActivitiesRoute, async function routeListActivities(c) {
  return c.json(await container.resolve(ActivityController).list(c.req.valid("query")), 200);
});

const getActivityRoute = createRoute({
  method: "get",
  path: "/v1/activities/{id}",
  operationId: "getActivity",
  summary: "Get one of the user's activities, for example to follow a close running in the background",
  tags: ["Activities"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: { params: GetActivityParamsSchema },
  responses: {
    200: { description: "The activity", content: { "application/json": { schema: GetActivityResponseSchema } } },
    400: { description: "The id is not a uuid" },
    401: { description: "Unauthorized" },
    404: { description: "No activity of the user's has this id" }
  }
});

activityRouter.openapi(getActivityRoute, async function routeGetActivity(c) {
  return c.json(await container.resolve(ActivityController).getById(c.req.valid("param").id), 200);
});

const markActivitiesSeenRoute = createRoute({
  method: "post",
  path: "/v1/activities/seen",
  operationId: "markActivitiesSeen",
  summary: "Mark activities seen, either by id or every one created up to a time",
  tags: ["Activities"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: { required: true, content: { "application/json": { schema: MarkActivitiesSeenRequestSchema } } }
  },
  responses: {
    200: { description: "How many activities are still unseen", content: { "application/json": { schema: MarkActivitiesSeenResponseSchema } } },
    400: { description: "Invalid request body" },
    401: { description: "Unauthorized" }
  }
});

activityRouter.openapi(markActivitiesSeenRoute, async function routeMarkActivitiesSeen(c) {
  const { data } = c.req.valid("json");
  return c.json(await container.resolve(ActivityController).markSeen(data), 200);
});
