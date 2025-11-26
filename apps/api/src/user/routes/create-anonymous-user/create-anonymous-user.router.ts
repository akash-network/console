import { OpenAPIHono } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import type { ClientInfoContextVariables } from "@src/middlewares/clientInfoMiddleware";
import { UserController } from "@src/user/controllers/user/user.controller";
import { AnonymousUserResponseOutputSchema } from "@src/user/schemas/user.schema";

const route = createRoute({
  method: "post",
  path: "/v1/anonymous-users",
  summary: "Creates an anonymous user",
  tags: ["Users"],
  security: SECURITY_NONE,
  request: {},
  responses: {
    200: {
      description: "Returns a created anonymous user",
      content: {
        "application/json": {
          schema: AnonymousUserResponseOutputSchema
        }
      }
    }
  }
});
export const createAnonymousUserRouter = new OpenAPIHono<{ Variables: ClientInfoContextVariables }>();

createAnonymousUserRouter.openapi(route, async function routeCreateUser(c) {
  return c.json(await container.resolve(UserController).create(), 200);
});
