import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { NotificationAddressConfirmationController } from "@src/notifications/controllers/notification-address-confirmation/notification-address-confirmation.controller";
import { CreateNotificationAddressConfirmationRequestSchema } from "@src/notifications/http-schemas/notification-address-confirmation.schema";

export const notificationAddressConfirmationsRouter = new OpenApiHonoHandler();

const createNotificationAddressConfirmationRoute = createRoute({
  method: "post",
  operationId: "createNotificationAddressConfirmation",
  path: "/v1/notification-address-confirmations",
  summary: "Confirm an address added to a notification channel through the link emailed to it, without signing in",
  tags: ["Notifications"],
  security: SECURITY_NONE,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateNotificationAddressConfirmationRequestSchema
        }
      }
    }
  },
  responses: {
    204: { description: "The address receives the channel's alerts from now on" },
    400: { description: "The confirmation link is invalid or was already used" }
  }
});

notificationAddressConfirmationsRouter.openapi(createNotificationAddressConfirmationRoute, async function routeCreateNotificationAddressConfirmation(c) {
  await container.resolve(NotificationAddressConfirmationController).create(c.req.valid("json").data.token);
  return c.body(null, 204);
});
