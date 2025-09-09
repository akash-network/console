import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { AuthController } from "@src/auth/controllers/auth/auth.controller";
import { VerifyEmailRequestSchema, VerifyEmailResponseSchema } from "@src/auth/http-schemas/verify-email.schema";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

export const verifyEmailRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "post",
  path: "/v1/verify-email",
  summary: "Checks if the email is verified",
  tags: ["Users"],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: VerifyEmailRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns email verification status",
      content: {
        "application/json": {
          schema: VerifyEmailResponseSchema
        }
      }
    },
    401: { description: "Unauthorized" },
    404: { description: "User not found" }
  }
});

verifyEmailRouter.post(route.path, async function verifyEmail(c) {
  const data = VerifyEmailRequestSchema.parse(await c.req.json());

  const result = await container.resolve(AuthController).syncEmailVerified(data);
  return c.json(result, 200);
});
