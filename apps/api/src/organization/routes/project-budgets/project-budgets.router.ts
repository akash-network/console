import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { ProjectBudgetController } from "@src/organization/controllers/project-budget/project-budget.controller";
import {
  CreateProjectBudgetRequestSchema,
  ListProjectBudgetsQuerySchema,
  ListProjectBudgetsResponseSchema,
  ProjectBudgetParamsSchema,
  ProjectBudgetResponseSchema,
  UpdateProjectBudgetRequestSchema
} from "@src/organization/http-schemas/project-budget.schema";

export const projectBudgetsRouter = new OpenApiHonoHandler();

const UNAUTHORIZED = { description: "Unauthorized" };
const FORBIDDEN = { description: "Only owners and admins can change project budgets" };
const NOT_FOUND = { description: "No budget with this id in the caller's reach" };

const listProjectBudgetsRoute = createRoute({
  method: "get",
  path: "/v1/project-budgets",
  operationId: "listProjectBudgets",
  summary: "List the project budgets of the active organization the caller can read",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: { query: ListProjectBudgetsQuerySchema },
  responses: {
    200: { description: "The budgets with this month's committed spend", content: { "application/json": { schema: ListProjectBudgetsResponseSchema } } },
    401: UNAUTHORIZED
  }
});

projectBudgetsRouter.openapi(listProjectBudgetsRoute, async function routeListProjectBudgets(c) {
  return c.json(await container.resolve(ProjectBudgetController).list(c.req.valid("query")), 200);
});

const createProjectBudgetRoute = createRoute({
  method: "post",
  path: "/v1/project-budgets",
  operationId: "createProjectBudget",
  summary: "Set a monthly budget for a project of the active organization",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    body: { required: true, content: { "application/json": { schema: CreateProjectBudgetRequestSchema } } }
  },
  responses: {
    201: { description: "The created budget", content: { "application/json": { schema: ProjectBudgetResponseSchema } } },
    400: { description: "The budget settings are not valid" },
    401: UNAUTHORIZED,
    403: FORBIDDEN,
    404: { description: "No project with this id in the caller's reach" },
    409: { description: "The project already has a budget (`project_budget_exists`)" }
  }
});

projectBudgetsRouter.openapi(createProjectBudgetRoute, async function routeCreateProjectBudget(c) {
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(ProjectBudgetController).create(data), 201);
});

const updateProjectBudgetRoute = createRoute({
  method: "patch",
  path: "/v1/project-budgets/{id}",
  operationId: "updateProjectBudget",
  summary: "Change a project's monthly budget",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: {
    params: ProjectBudgetParamsSchema,
    body: { required: true, content: { "application/json": { schema: UpdateProjectBudgetRequestSchema } } }
  },
  responses: {
    200: { description: "The updated budget", content: { "application/json": { schema: ProjectBudgetResponseSchema } } },
    400: { description: "The budget settings are not valid" },
    401: UNAUTHORIZED,
    403: FORBIDDEN,
    404: NOT_FOUND
  }
});

projectBudgetsRouter.openapi(updateProjectBudgetRoute, async function routeUpdateProjectBudget(c) {
  const { id } = c.req.valid("param");
  const { data } = c.req.valid("json");

  return c.json(await container.resolve(ProjectBudgetController).update(id, data), 200);
});

const deleteProjectBudgetRoute = createRoute({
  method: "delete",
  path: "/v1/project-budgets/{id}",
  operationId: "deleteProjectBudget",
  summary: "Remove a project's monthly budget",
  tags: ["Projects"],
  security: SECURITY_BEARER_OR_API_KEY,
  featureFlag: FeatureFlags.ORGANIZATIONS,
  request: { params: ProjectBudgetParamsSchema },
  responses: {
    204: { description: "The budget is removed" },
    401: UNAUTHORIZED,
    403: FORBIDDEN,
    404: NOT_FOUND
  }
});

projectBudgetsRouter.openapi(deleteProjectBudgetRoute, async function routeDeleteProjectBudget(c) {
  const { id } = c.req.valid("param");
  await container.resolve(ProjectBudgetController).delete(id);

  return c.body(null, 204);
});
