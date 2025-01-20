import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { AuthController } from "@src/auth/controllers/auth/auth.controller";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

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
export const sendVerificationEmailRouter = new OpenApiHonoHandler();

sendVerificationEmailRouter.openapi(route, async function verifyEmail(c) {
  await container.resolve(AuthController).sendVerificationEmail(c.req.valid("json"));
  return c.text("", 200);
});
