import { container } from "tsyringe";
import { z } from "zod";

import { AuthController } from "@src/auth/controllers/auth/auth.controller";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER } from "@src/core/services/openapi-docs/openapi-security";

export const sendVerificationCodeRouter = new OpenApiHonoHandler();

const SendVerificationCodeResponseSchema = z.object({
  data: z.object({
    codeSentAt: z.string()
  })
});

const route = createRoute({
  method: "post",
  path: "/v1/send-verification-code",
  summary: "Sends a verification code to the authenticated user's email",
  tags: ["Users"],
  security: SECURITY_BEARER,
  responses: {
    200: {
      description: "Returns the timestamp when the code was sent",
      content: {
        "application/json": {
          schema: SendVerificationCodeResponseSchema
        }
      }
    },
    429: { description: "Too many requests" }
  }
});

sendVerificationCodeRouter.openapi(route, async function sendVerificationCode(c) {
  const result = await container.resolve(AuthController).sendVerificationCode();
  return c.json(result, 200);
});
