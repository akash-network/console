import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { UserController } from "@src/user/controllers/user/user.controller";
import { GetUserResponseOutputSchema } from "@src/user/schemas/user.schema";

const route = createRoute({
  method: "get",
  path: "/v1/user/me",
  summary: "Retrieves the logged in user",
  tags: ["Users"],
  responses: {
    200: {
      description: "Returns the logged in user",
      body: {
        content: {
          "application/json": {
            schema: GetUserResponseOutputSchema
          }
        }
      }
    }
  }
});
export const getCurrentUserRouter = new OpenApiHonoHandler().openapi(route, async function getCurrentUser(c) {
  return c.json(await container.resolve(UserController).getCurrentUser(), 200);
});
