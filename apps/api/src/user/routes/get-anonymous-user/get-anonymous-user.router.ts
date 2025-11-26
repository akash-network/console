import { container } from "tsyringe";
import { z } from "zod";

import { createRoute } from "@src/core/services/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { UserController } from "@src/user/controllers/user/user.controller";
import { GetUserResponseOutputSchema } from "@src/user/schemas/user.schema";

export const GetUserParamsSchema = z.object({ id: z.string().uuid() });

export type GetUserParams = z.infer<typeof GetUserParamsSchema>;

export const getAnonymousUserRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "get",
  path: "/v1/anonymous-users/{id}",
  summary: "Retrieves an anonymous user by id",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: GetUserParamsSchema
  },
  responses: {
    200: {
      description: "Returns an anonymous user",
      content: {
        "application/json": {
          schema: GetUserResponseOutputSchema
        }
      }
    }
  }
});
getAnonymousUserRouter.openapi(route, async function routeWallet(c) {
  return c.json(await container.resolve(UserController).getById(c.req.valid("param")), 200);
});
