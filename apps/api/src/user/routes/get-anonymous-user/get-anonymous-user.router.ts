import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { UserController } from "@src/user/controllers/user/user.controller";
import { GetUserResponseOutputSchema } from "@src/user/schemas/user.schema";

export const GetUserParamsSchema = z.object({ id: z.string() });

export type GetUserParams = z.infer<typeof GetUserParamsSchema>;

const route = createRoute({
  method: "get",
  path: "/v1/anonymous-users/:id",
  summary: "Retrieves an anonymous user by id",
  tags: ["Users"],
  request: {
    params: GetUserParamsSchema
  },
  responses: {
    200: {
      description: "Returns an anonymous user",
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
export const getAnonymousUserRouter = new OpenApiHonoHandler();

getAnonymousUserRouter.openapi(route, async function routeWallet(c) {
  return c.json(await container.resolve(UserController).getById(c.req.valid("param")), 200);
});
