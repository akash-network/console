import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { UserController } from "@src/user/controllers/user/user.controller";
import { UserSchema } from "@src/user/schemas/user.schema";

const registerUserInputSchema = z.object({
  wantedUsername: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  subscribedToNewsletter: z.boolean().optional()
});
export type RegisterUserInput = z.infer<typeof registerUserInputSchema>;

const registerUserResponseSchema = z.object({
  data: UserSchema
});
export type RegisterUserResponse = z.infer<typeof registerUserResponseSchema>;

const route = createRoute({
  method: "post",
  path: "/v1/register-user",
  summary: "Registers a new user",
  tags: ["Users"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: registerUserInputSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns the registered user",
      content: {
        "application/json": {
          schema: registerUserResponseSchema
        }
      }
    }
  }
});
export const registerUserRouter = new OpenApiHonoHandler().openapi(route, async function registerUser(c) {
  const data = await container.resolve(UserController).registerUser(c.req.valid("json"));
  return c.json(data, 200);
});
