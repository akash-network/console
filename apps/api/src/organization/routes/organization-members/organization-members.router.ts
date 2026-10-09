import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { OrganizationMemberController } from "@src/organization/controllers/organization-member/organization-member.controller";
import {
  ListOrganizationMembersResponseSchema,
  OrganizationMemberParamsSchema,
  OrganizationMemberResponseSchema,
  UpdateOrganizationMemberRequestSchema
} from "@src/organization/http-schemas/organization-member.schema";

export const organizationMembersRouter = new OpenApiHonoHandler();

const memberWriteErrorResponses = {
  401: { description: "Unauthorized" },
  403: { description: "The caller cannot change this member, or the active organization is a personal one" },
  404: { description: "No such member in the active organization" },
  409: { description: "The organization would be left without an owner" }
};

const listOrganizationMembersRoute = createRoute({
  method: "get",
  path: "/v1/organization-members",
  operationId: "listOrganizationMembers",
  summary: "List the members of the active organization",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  responses: {
    200: { description: "The organization's members", content: { "application/json": { schema: ListOrganizationMembersResponseSchema } } },
    401: { description: "Unauthorized" },
    403: { description: "The caller cannot see the organization's members" }
  }
});

organizationMembersRouter.openapi(listOrganizationMembersRoute, async function routeListOrganizationMembers(c) {
  return c.json(await container.resolve(OrganizationMemberController).list(), 200);
});

const updateOrganizationMemberRoute = createRoute({
  method: "patch",
  path: "/v1/organization-members/{id}",
  operationId: "updateOrganizationMember",
  summary: "Change the role of a member of the active organization",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    params: OrganizationMemberParamsSchema,
    body: { content: { "application/json": { schema: UpdateOrganizationMemberRequestSchema } } }
  },
  responses: {
    200: { description: "The updated member", content: { "application/json": { schema: OrganizationMemberResponseSchema } } },
    ...memberWriteErrorResponses
  }
});

organizationMembersRouter.openapi(updateOrganizationMemberRoute, async function routeUpdateOrganizationMember(c) {
  const { id } = c.req.valid("param");
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(OrganizationMemberController).update(id, data), 200);
});

const deleteOrganizationMemberRoute = createRoute({
  method: "delete",
  path: "/v1/organization-members/{id}",
  operationId: "deleteOrganizationMember",
  summary: "Remove a member from the active organization",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    params: OrganizationMemberParamsSchema
  },
  responses: {
    204: { description: "The member was removed" },
    ...memberWriteErrorResponses
  }
});

organizationMembersRouter.openapi(deleteOrganizationMemberRoute, async function routeDeleteOrganizationMember(c) {
  const { id } = c.req.valid("param");
  await container.resolve(OrganizationMemberController).delete(id);

  return c.body(null, 204);
});

const transferOrganizationOwnershipRoute = createRoute({
  method: "post",
  path: "/v1/organization-members/{id}/ownership-transfer",
  operationId: "transferOrganizationOwnership",
  summary: "Make a member an owner of the active organization and step the calling owner down to admin",
  tags: ["Organizations"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    params: OrganizationMemberParamsSchema
  },
  responses: {
    200: { description: "The member who received ownership", content: { "application/json": { schema: OrganizationMemberResponseSchema } } },
    400: { description: "The member is the caller" },
    ...memberWriteErrorResponses
  }
});

organizationMembersRouter.openapi(transferOrganizationOwnershipRoute, async function routeTransferOrganizationOwnership(c) {
  const { id } = c.req.valid("param");

  return c.json(await container.resolve(OrganizationMemberController).transferOwnership(id), 200);
});
