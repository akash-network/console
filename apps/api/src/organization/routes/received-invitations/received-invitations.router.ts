import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER } from "@src/core/services/openapi-docs/openapi-security";
import { InvitationController } from "@src/organization/controllers/invitation/invitation.controller";
import {
  AcceptInvitationResponseSchema,
  ListReceivedInvitationsResponseSchema,
  ReceivedInvitationParamsSchema
} from "@src/organization/http-schemas/invitation.schema";

export const receivedInvitationsRouter = new OpenApiHonoHandler();

const SESSION_REQUIRED = { description: "Requested with an API key instead of a signed-in session (`session_required`)" };

const receivedInvitationErrorResponses = {
  400: { description: "The id is not a uuid" },
  401: { description: "Unauthorized" },
  403: SESSION_REQUIRED,
  404: { description: "No invitation with this id was sent to the caller's verified email, or its organization was deleted" }
};

const listReceivedInvitationsRoute = createRoute({
  method: "get",
  path: "/v1/received-invitations",
  operationId: "listReceivedInvitations",
  summary: "List the pending invitations sent to the caller's verified email",
  description: "An account whose email is not verified receives none, since anyone can sign up with an address they do not own.",
  tags: ["Organizations"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  responses: {
    200: { description: "The invitations the caller can still accept", content: { "application/json": { schema: ListReceivedInvitationsResponseSchema } } },
    401: { description: "Unauthorized" },
    403: SESSION_REQUIRED
  }
});

receivedInvitationsRouter.openapi(listReceivedInvitationsRoute, async function routeListReceivedInvitations(c) {
  return c.json(await container.resolve(InvitationController).listReceived({ authMethod: c.get("authMethod") }), 200);
});

const acceptReceivedInvitationRoute = createRoute({
  method: "post",
  path: "/v1/received-invitations/{id}/accept",
  operationId: "acceptReceivedInvitation",
  summary: "Join the organization of an invitation sent to the caller's verified email, without the token of its link",
  tags: ["Organizations"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    params: ReceivedInvitationParamsSchema
  },
  responses: {
    200: { description: "The organization the caller now belongs to", content: { "application/json": { schema: AcceptInvitationResponseSchema } } },
    ...receivedInvitationErrorResponses,
    409: {
      description: "The caller accepted the invitation and has since left (`invitation_already_accepted`)"
    },
    410: { description: "The invitation expired (`invitation_expired`), was revoked (`invitation_revoked`) or was declined (`invitation_declined`)" }
  }
});

receivedInvitationsRouter.openapi(acceptReceivedInvitationRoute, async function routeAcceptReceivedInvitation(c) {
  const { id } = c.req.valid("param");

  return c.json(await container.resolve(InvitationController).acceptReceived(id, { authMethod: c.get("authMethod") }), 200);
});

const declineReceivedInvitationRoute = createRoute({
  method: "post",
  path: "/v1/received-invitations/{id}/decline",
  operationId: "declineReceivedInvitation",
  summary: "Decline an invitation sent to the caller's verified email",
  description: "Declining an invitation twice changes nothing. The team's activity shows the invited address, not the account that declined.",
  tags: ["Organizations"],
  security: SECURITY_BEARER,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    params: ReceivedInvitationParamsSchema
  },
  responses: {
    204: { description: "The invitation was declined" },
    ...receivedInvitationErrorResponses,
    409: { description: "The invitation was already accepted (`invitation_already_accepted`)" },
    410: { description: "The invitation expired (`invitation_expired`) or was revoked (`invitation_revoked`)" }
  }
});

receivedInvitationsRouter.openapi(declineReceivedInvitationRoute, async function routeDeclineReceivedInvitation(c) {
  const { id } = c.req.valid("param");
  await container.resolve(InvitationController).declineReceived(id, { authMethod: c.get("authMethod") });

  return c.body(null, 204);
});
