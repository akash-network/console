import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { ProjectController } from "@src/organization/controllers/project/project.controller";
import {
  CreateProjectRequestSchema,
  ListProjectsResponseSchema,
  ProjectParamsSchema,
  ProjectResponseSchema,
  UpdateProjectRequestSchema
} from "@src/organization/http-schemas/project.schema";

export const projectsRouter = new OpenApiHonoHandler();

const UNAUTHORIZED = { description: "Unauthorized" };
const FORBIDDEN = { description: "The caller's role in the active organization does not allow it" };
const NOT_FOUND = { description: "No project with this id in the caller's reach" };

const listProjectsRoute = createRoute({
  method: "get",
  path: "/v1/projects",
  operationId: "listProjects",
  summary: "List the projects of the active organization the caller can reach",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  responses: {
    200: { description: "The projects, default first", content: { "application/json": { schema: ListProjectsResponseSchema } } },
    401: UNAUTHORIZED
  }
});

projectsRouter.openapi(listProjectsRoute, async function routeListProjects(c) {
  return c.json(await container.resolve(ProjectController).list(), 200);
});

const createProjectRoute = createRoute({
  method: "post",
  path: "/v1/projects",
  operationId: "createProject",
  summary: "Create a project in the active organization",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    body: { required: true, content: { "application/json": { schema: CreateProjectRequestSchema } } }
  },
  responses: {
    201: { description: "The created project", content: { "application/json": { schema: ProjectResponseSchema } } },
    400: { description: "The name or description is not valid" },
    401: UNAUTHORIZED,
    403: FORBIDDEN,
    409: { description: "Another project of the organization has this name (`project_name_taken`)" }
  }
});

projectsRouter.openapi(createProjectRoute, async function routeCreateProject(c) {
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(ProjectController).create(data), 201);
});

const getProjectRoute = createRoute({
  method: "get",
  path: "/v1/projects/{id}",
  operationId: "getProject",
  summary: "Get a project of the active organization",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: { params: ProjectParamsSchema },
  responses: {
    200: { description: "The project", content: { "application/json": { schema: ProjectResponseSchema } } },
    401: UNAUTHORIZED,
    404: NOT_FOUND
  }
});

projectsRouter.openapi(getProjectRoute, async function routeGetProject(c) {
  const { id } = c.req.valid("param");

  return c.json(await container.resolve(ProjectController).get(id), 200);
});

const updateProjectRoute = createRoute({
  method: "patch",
  path: "/v1/projects/{id}",
  operationId: "updateProject",
  summary: "Rename a project or change its description",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    params: ProjectParamsSchema,
    body: { required: true, content: { "application/json": { schema: UpdateProjectRequestSchema } } }
  },
  responses: {
    200: { description: "The updated project", content: { "application/json": { schema: ProjectResponseSchema } } },
    400: { description: "The name or description is not valid" },
    401: UNAUTHORIZED,
    403: FORBIDDEN,
    404: NOT_FOUND,
    409: { description: "Another project of the organization has this name (`project_name_taken`)" }
  }
});

projectsRouter.openapi(updateProjectRoute, async function routeUpdateProject(c) {
  const { id } = c.req.valid("param");
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(ProjectController).update(id, data), 200);
});

const deleteProjectRoute = createRoute({
  method: "delete",
  path: "/v1/projects/{id}",
  operationId: "deleteProject",
  summary: "Delete a project that holds no open deployment",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: { params: ProjectParamsSchema },
  responses: {
    204: { description: "The project is deleted" },
    401: UNAUTHORIZED,
    403: FORBIDDEN,
    404: NOT_FOUND,
    409: { description: "The project is the organization's default (`project_is_default`) or still holds open deployments (`project_not_empty`)" }
  }
});

projectsRouter.openapi(deleteProjectRoute, async function routeDeleteProject(c) {
  const { id } = c.req.valid("param");
  await container.resolve(ProjectController).delete(id);

  return c.body(null, 204);
});
