import { z } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { requireInternalToken } from "@src/middlewares/internal-token/internal-token.middleware";
import { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";

/** Intentionally permissive: the caller needs a verdict for whatever it holds, not a validation error. */
const EmailDomainCheckRequestSchema = z.object({
  email: z.string()
});

/** The verdict only: this response must not disclose why. */
const EmailDomainCheckResponseSchema = z.object({
  blocked: z.boolean()
});

const route = createRoute({
  method: "post",
  path: "/auth/email-domain-check",
  summary: "Whether an email address belongs to a blocked domain",
  operationId: "validateEmailDomain",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: {
    body: {
      content: {
        "application/json": {
          schema: EmailDomainCheckRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "The verdict for the address",
      content: {
        "application/json": {
          schema: EmailDomainCheckResponseSchema
        }
      }
    }
  }
});

export default new OpenApiHonoHandler().openapi(route, async function routePostValidateEmailDomain(c) {
  const { email } = c.req.valid("json");
  const blocked = await container.resolve(BlockedEmailDomainService).isBlockedEmail(email);

  c.header("Cache-Control", "no-store");

  return c.json({ blocked }, 200);
});
