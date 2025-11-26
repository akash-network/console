import { VerifyEmailResponseSchema } from "@akashnetwork/http-sdk";
import { container } from "tsyringe";

import { AuthController } from "@src/auth/controllers/auth/auth.controller";
import { VerifyEmailRequestSchema } from "@src/auth/http-schemas/verify-email.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

export const verifyEmailRouter = new OpenApiHonoHandler();

const route = createRoute({
  method: "post",
  path: "/v1/verify-email",
  summary: "Checks if the email is verified",
  tags: ["Users"],
  security: SECURITY_NONE,
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

verifyEmailRouter.openapi(route, async function verifyEmail(c) {
  const result = await container.resolve(AuthController).syncEmailVerified(c.req.valid("json"));
  return c.json(result, 200);
});
