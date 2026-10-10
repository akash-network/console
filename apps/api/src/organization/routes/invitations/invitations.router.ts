import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY, SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { InvitationController } from "@src/organization/controllers/invitation/invitation.controller";
import {
  AcceptInvitationRequestSchema,
  AcceptInvitationResponseSchema,
  InvitationPreviewResponseSchema,
  PreviewInvitationRequestSchema
} from "@src/organization/http-schemas/invitation.schema";

export const invitationsRouter = new OpenApiHonoHandler();

const previewInvitationRoute = createRoute({
  method: "post",
  path: "/v1/invitations/preview",
  operationId: "previewInvitation",
  summary: "Preview an organization invitation from the token of its link",
  tags: ["Organizations"],
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  request: {
    body: { required: true, content: { "application/json": { schema: PreviewInvitationRequestSchema } } }
  },
  responses: {
    200: {
      description: "Who sent the invitation, to which organization and in which state",
      content: { "application/json": { schema: InvitationPreviewResponseSchema } }
    },
    400: { description: "The token is not an invitation token" },
    404: { description: "No invitation has this token" }
  }
});

invitationsRouter.openapi(previewInvitationRoute, async function routePreviewInvitation(c) {
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(InvitationController).preview(data), 200);
});

const acceptInvitationRoute = createRoute({
  method: "post",
  path: "/v1/invitations/accept",
  operationId: "acceptInvitation",
  summary: "Join the organization of an invitation with the role and project access it grants",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    body: { required: true, content: { "application/json": { schema: AcceptInvitationRequestSchema } } }
  },
  responses: {
    200: { description: "The organization the caller now belongs to", content: { "application/json": { schema: AcceptInvitationResponseSchema } } },
    400: { description: "The token is not an invitation token" },
    401: { description: "Unauthorized" },
    404: { description: "No invitation has this token" },
    409: { description: "The invitation was sent to another email address and the caller did not confirm, or someone else already accepted it" },
    410: { description: "The invitation expired or was revoked" }
  }
});

invitationsRouter.openapi(acceptInvitationRoute, async function routeAcceptInvitation(c) {
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(InvitationController).accept(data), 200);
});
