import { container } from "tsyringe";
import { z } from "zod";

import { AuthController } from "@src/auth/controllers/auth/auth.controller";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";

export const sendVerificationEmailRouter = new OpenApiHonoHandler();

const SendVerificationEmailRequestInputSchema = z.object({
  data: z.object({
    userId: z.string()
  })
});

export type SendVerificationEmailRequestInput = z.infer<typeof SendVerificationEmailRequestInputSchema>;

const route = createRoute({
  method: "post",
  path: "/v1/send-verification-email",
  summary: "Resends a verification email",
  tags: ["Users"],
  security: SECURITY_NONE,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: SendVerificationEmailRequestInputSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns a created wallet",
      content: {}
    }
  }
});

sendVerificationEmailRouter.openapi(route, async function verifyEmail(c) {
  await container.resolve(AuthController).sendVerificationEmail(c.req.valid("json"));
  return c.text("", 200) as never;
});
