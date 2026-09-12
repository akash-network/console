import { OpenAPIHono, z } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { requireInternalToken } from "@src/middlewares/internal-token/internal-token.middleware";
import { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";

/** Not `.email()`: an address we cannot parse is answered `blocked: false`, never rejected, so a caller can always act on the response. */
const EmailDomainCheckRequestSchema = z.object({
  email: z.string().min(3).max(320)
});

/** Only the verdict. Echoing the reason or the row would tell a leaked token what the blocklist contains. */
const EmailDomainCheckResponseSchema = z.object({
  blocked: z.boolean()
});

/** Authenticated by requireInternalToken below rather than by a scheme, because the caller is a machine holding a shared secret. */
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

export default new OpenAPIHono().openapi(route, async function routePostValidateEmailDomain(c) {
  const { email } = c.req.valid("json");
  const blocked = await container.resolve(BlockedEmailDomainService).isBlockedEmail(email);

  c.header("Cache-Control", "no-store");

  return c.json({ blocked }, 200);
});
