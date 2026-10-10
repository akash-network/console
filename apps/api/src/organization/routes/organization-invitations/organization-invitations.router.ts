import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { OrganizationInvitationController } from "@src/organization/controllers/organization-invitation/organization-invitation.controller";
import {
  CreateOrganizationInvitationsRequestSchema,
  ListOrganizationInvitationsResponseSchema,
  OrganizationInvitationLinkResponseSchema,
  OrganizationInvitationParamsSchema,
  OrganizationInvitationResponseSchema
} from "@src/organization/http-schemas/organization-invitation.schema";

export const organizationInvitationsRouter = new OpenApiHonoHandler();

const invitationWriteErrorResponses = {
  401: { description: "Unauthorized" },
  403: { description: "The caller cannot manage this invitation, or the active organization is a personal one" },
  404: { description: "No such pending invitation in the active organization" }
};

const listOrganizationInvitationsRoute = createRoute({
  method: "get",
  path: "/v1/organization-invitations",
  operationId: "listOrganizationInvitations",
  summary: "List the pending invitations of the active organization",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  responses: {
    200: { description: "The pending invitations", content: { "application/json": { schema: ListOrganizationInvitationsResponseSchema } } },
    401: { description: "Unauthorized" },
    403: { description: "The caller cannot see the organization's invitations" }
  }
});

organizationInvitationsRouter.openapi(listOrganizationInvitationsRoute, async function routeListOrganizationInvitations(c) {
  return c.json(await container.resolve(OrganizationInvitationController).list(), 200);
});

const createOrganizationInvitationsRoute = createRoute({
  method: "post",
  path: "/v1/organization-invitations",
  operationId: "createOrganizationInvitations",
  summary: "Invite people to the active organization by email",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    body: { required: true, content: { "application/json": { schema: CreateOrganizationInvitationsRequestSchema } } }
  },
  responses: {
    201: {
      description: "One pending invitation per address, an address that was already invited keeping its existing one",
      content: { "application/json": { schema: ListOrganizationInvitationsResponseSchema } }
    },
    400: { description: "A project grant names a project outside the active organization" },
    401: { description: "Unauthorized" },
    403: { description: "The caller cannot invite with this role, the active organization is a personal one, or it has too many pending invitations" },
    409: { description: "An address belongs to a member of the organization" },
    429: { description: "Too many invitation emails were sent recently" }
  }
});

organizationInvitationsRouter.openapi(createOrganizationInvitationsRoute, async function routeCreateOrganizationInvitations(c) {
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(OrganizationInvitationController).create(data), 201);
});

const resendOrganizationInvitationRoute = createRoute({
  method: "post",
  path: "/v1/organization-invitations/{id}/resend",
  operationId: "resendOrganizationInvitation",
  summary: "Email a pending invitation again with a new link and a new expiry",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    params: OrganizationInvitationParamsSchema
  },
  responses: {
    200: { description: "The renewed invitation", content: { "application/json": { schema: OrganizationInvitationResponseSchema } } },
    ...invitationWriteErrorResponses,
    429: { description: "Too many invitation emails were sent recently" }
  }
});

organizationInvitationsRouter.openapi(resendOrganizationInvitationRoute, async function routeResendOrganizationInvitation(c) {
  const { id } = c.req.valid("param");

  return c.json(await container.resolve(OrganizationInvitationController).resend(id), 200);
});

const createOrganizationInvitationLinkRoute = createRoute({
  method: "post",
  path: "/v1/organization-invitations/{id}/link",
  operationId: "createOrganizationInvitationLink",
  summary: "Issue a new link for a pending invitation, which stops every earlier link from working",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    params: OrganizationInvitationParamsSchema
  },
  responses: {
    200: { description: "The invitation link", content: { "application/json": { schema: OrganizationInvitationLinkResponseSchema } } },
    ...invitationWriteErrorResponses
  }
});

organizationInvitationsRouter.openapi(createOrganizationInvitationLinkRoute, async function routeCreateOrganizationInvitationLink(c) {
  const { id } = c.req.valid("param");

  return c.json(await container.resolve(OrganizationInvitationController).createLink(id), 200);
});

const deleteOrganizationInvitationRoute = createRoute({
  method: "delete",
  path: "/v1/organization-invitations/{id}",
  operationId: "deleteOrganizationInvitation",
  summary: "Revoke a pending invitation of the active organization",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    params: OrganizationInvitationParamsSchema
  },
  responses: {
    204: { description: "The invitation was revoked" },
    ...invitationWriteErrorResponses
  }
});

organizationInvitationsRouter.openapi(deleteOrganizationInvitationRoute, async function routeDeleteOrganizationInvitation(c) {
  const { id } = c.req.valid("param");
  await container.resolve(OrganizationInvitationController).delete(id);

  return c.body(null, 204);
});
