import { container } from "tsyringe";
import { z } from "zod";

import { AuthController } from "@src/auth/controllers/auth/auth.controller";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

const signupInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export type SignupInput = z.infer<typeof signupInputSchema>;

const route = createRoute({
  method: "post",
  path: "/v1/auth/signup",
  summary: "Creates a new user without sending a verification email",
  tags: ["Auth"],
  security: SECURITY_NONE,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: signupInputSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "User created successfully",
      content: {}
    }
  }
});

export const signupRouter = new OpenApiHonoHandler();

signupRouter.openapi(route, async function signup(c) {
  await container.resolve(AuthController).signup(c.req.valid("json"));
  return c.text("", 200) as never;
});
