import { container } from "tsyringe";
import { z } from "zod";

import { AuthController } from "@src/auth/controllers/auth/auth.controller";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER } from "@src/core/services/openapi-docs/openapi-security";

export const verifyEmailCodeRouter = new OpenApiHonoHandler();

const VerifyEmailCodeRequestSchema = z.object({
  data: z.object({
    userId: z.string(),
    code: z.string().length(6)
  })
});

export type VerifyEmailCodeRequest = z.infer<typeof VerifyEmailCodeRequestSchema>;

const VerifyEmailCodeResponseSchema = z.object({
  data: z.object({
    emailVerified: z.boolean()
  })
});

const route = createRoute({
  method: "post",
  path: "/v1/verify-email-code",
  summary: "Verifies the email using a 6-digit code",
  tags: ["Users"],
  security: SECURITY_BEARER,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: VerifyEmailCodeRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns the email verification status",
      content: {
        "application/json": {
          schema: VerifyEmailCodeResponseSchema
        }
      }
    },
    400: { description: "Invalid or expired code" },
    429: { description: "Too many attempts" }
  }
});

verifyEmailCodeRouter.openapi(route, async function verifyEmailCode(c) {
  const result = await container.resolve(AuthController).verifyEmailCode(c.req.valid("json"));
  return c.json(result, 200);
});
