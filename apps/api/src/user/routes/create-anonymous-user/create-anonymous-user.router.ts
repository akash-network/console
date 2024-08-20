import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { UserController } from "@src/user/controllers/user/user.controller";
import { AnonymousUserResponseOutputSchema } from "@src/user/schemas/user.schema";

const route = createRoute({
  method: "post",
  path: "/v1/anonymous-users",
  summary: "Creates an anonymous user",
  tags: ["Users"],
  request: {},
  responses: {
    200: {
      description: "Returns a created anonymous user",
      body: {
        content: {
          "application/json": {
            schema: AnonymousUserResponseOutputSchema
          }
        }
      }
    }
  }
});
export const createAnonymousUserRouter = new OpenAPIHono();

createAnonymousUserRouter.openapi(route, async function routeCreateUser(c) {
  return c.json(await container.resolve(UserController).createAnonymous(), 200);
});
