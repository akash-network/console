import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { UserController } from "@src/user/controllers/user/user.controller";
import { GetUserResponseOutputSchema } from "@src/user/schemas/user.schema";

const route = createRoute({
  method: "get",
  path: "/v1/user/me",
  summary: "Retrieves the logged in user",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  responses: {
    200: {
      description: "Returns the logged in user",
      content: {
        "application/json": {
          schema: GetUserResponseOutputSchema
        }
      }
    }
  }
});
export const getCurrentUserRouter = new OpenApiHonoHandler().openapi(route, async function getCurrentUser(c) {
  return c.json(await container.resolve(UserController).getCurrentUser(), 200);
});
