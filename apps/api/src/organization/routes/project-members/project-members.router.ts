import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { ProjectMemberController } from "@src/organization/controllers/project-member/project-member.controller";
import { ProjectParamsSchema } from "@src/organization/http-schemas/project.schema";
import {
  CreateProjectMemberRequestSchema,
  ListProjectMembersResponseSchema,
  ProjectMemberParamsSchema,
  ProjectMemberResponseSchema,
  UpdateProjectMemberRequestSchema
} from "@src/organization/http-schemas/project-member.schema";

export const projectMembersRouter = new OpenApiHonoHandler();

const UNAUTHORIZED = { description: "Unauthorized" };
const FORBIDDEN = { description: "Only owners and admins of the active organization manage project access" };
const GRANT_NOT_FOUND = { description: "No grant with this id on a live project of the active organization" };

const listProjectMembersRoute = createRoute({
  method: "get",
  path: "/v1/projects/{id}/members",
  operationId: "listProjectMembers",
  summary: "List who was granted access to a project",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: { params: ProjectParamsSchema },
  responses: {
    200: { description: "The project's grants", content: { "application/json": { schema: ListProjectMembersResponseSchema } } },
    401: UNAUTHORIZED,
    403: { description: "The caller's role in the active organization does not allow it" },
    404: { description: "No project with this id in the caller's reach" }
  }
});

projectMembersRouter.openapi(listProjectMembersRoute, async function routeListProjectMembers(c) {
  const { id } = c.req.valid("param");

  return c.json(await container.resolve(ProjectMemberController).list(id), 200);
});

const createProjectMemberRoute = createRoute({
  method: "post",
  path: "/v1/project-members",
  operationId: "createProjectMember",
  summary: "Grant a member or viewer of the active organization access to a project",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    body: { required: true, content: { "application/json": { schema: CreateProjectMemberRequestSchema } } }
  },
  responses: {
    201: { description: "The created grant", content: { "application/json": { schema: ProjectMemberResponseSchema } } },
    400: { description: "The body is not valid" },
    401: UNAUTHORIZED,
    403: FORBIDDEN,
    404: { description: "No such project or member in the active organization" },
    409: {
      description:
        "The user already has access to the project (`already_granted`), reaches every project as an owner or admin (`implicit_project_access`) or is a billing member (`billing_role_not_grantable`)"
    }
  }
});

projectMembersRouter.openapi(createProjectMemberRoute, async function routeCreateProjectMember(c) {
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(ProjectMemberController).create(data), 201);
});

const updateProjectMemberRoute = createRoute({
  method: "patch",
  path: "/v1/project-members/{id}",
  operationId: "updateProjectMember",
  summary: "Change the role a grant gives on its project",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    params: ProjectMemberParamsSchema,
    body: { required: true, content: { "application/json": { schema: UpdateProjectMemberRequestSchema } } }
  },
  responses: {
    200: { description: "The updated grant", content: { "application/json": { schema: ProjectMemberResponseSchema } } },
    400: { description: "The body is not valid" },
    401: UNAUTHORIZED,
    403: FORBIDDEN,
    404: GRANT_NOT_FOUND
  }
});

projectMembersRouter.openapi(updateProjectMemberRoute, async function routeUpdateProjectMember(c) {
  const { id } = c.req.valid("param");
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(ProjectMemberController).update(id, data), 200);
});

const deleteProjectMemberRoute = createRoute({
  method: "delete",
  path: "/v1/project-members/{id}",
  operationId: "deleteProjectMember",
  summary: "Revoke a grant, effective from the member's next request",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: { params: ProjectMemberParamsSchema },
  responses: {
    204: { description: "The grant is revoked" },
    401: UNAUTHORIZED,
    403: FORBIDDEN,
    404: GRANT_NOT_FOUND
  }
});

projectMembersRouter.openapi(deleteProjectMemberRoute, async function routeDeleteProjectMember(c) {
  const { id } = c.req.valid("param");
  await container.resolve(ProjectMemberController).delete(id);

  return c.body(null, 204);
});
