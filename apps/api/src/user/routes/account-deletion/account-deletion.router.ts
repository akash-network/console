import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER, SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { AccountDeletionController } from "@src/user/controllers/account-deletion/account-deletion.controller";
import { ConfirmAccountDeletionRequestSchema, InitiateAccountDeletionRequestSchema } from "@src/user/http-schemas/account-deletion.schema";

export const accountDeletionRouter = new OpenApiHonoHandler();

const initiateRoute = createRoute({
  method: "post",
  path: "/v1/user/me/initiate-deletion",
  operationId: "createAccountDeletionRequest",
  summary: "Emails the signed-in user a link that permanently deletes their account",
  tags: ["Users"],
  security: SECURITY_BEARER,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: InitiateAccountDeletionRequestSchema } }
    }
  },
  responses: {
    204: { description: "Confirmation link sent" },
    400: { description: "The account has credits and the forfeit was not acknowledged" },
    401: { description: "Unauthorized" },
    403: { description: "Requested with an API key instead of a signed-in session" },
    404: { description: "Account deletion is not available" },
    409: { description: "The account has active deployments" },
    429: { description: "A link was sent less than a minute ago" }
  }
});

accountDeletionRouter.openapi(initiateRoute, async function createAccountDeletionRequest(c) {
  await container
    .resolve(AccountDeletionController)
    .initiate(c.req.valid("json"), { authMethod: c.get("authMethod"), ip: c.var.clientInfo?.ip, userAgent: c.var.clientInfo?.userAgent });
  return c.body(null, 204);
});

const confirmRoute = createRoute({
  method: "post",
  path: "/v1/user/me/confirm-deletion",
  operationId: "confirmAccountDeletion",
  summary: "Permanently deletes the account a deletion link was sent for",
  tags: ["Users"],
  security: SECURITY_NONE,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: ConfirmAccountDeletionRequestSchema } }
    }
  },
  responses: {
    204: { description: "Account deleted" },
    400: { description: "The link is invalid or expired" },
    404: { description: "Account deletion is not available" },
    409: { description: "The account has active deployments or credits nobody agreed to forfeit" }
  }
});

accountDeletionRouter.openapi(confirmRoute, async function confirmAccountDeletion(c) {
  await container.resolve(AccountDeletionController).confirm(c.req.valid("json"), { ip: c.var.clientInfo?.ip });
  return c.body(null, 204);
});
