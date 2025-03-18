import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import {
  CloseDeploymentParamsSchema,
  CloseDeploymentResponseSchema,
  CreateDeploymentRequestSchema,
  CreateDeploymentResponseSchema,
  DepositDeploymentParamsSchema,
  DepositDeploymentRequestSchema,
  DepositDeploymentResponseSchema,
  GetDeploymentQuerySchema,
  GetDeploymentResponseSchema
} from "@src/deployment/http-schemas/deployment.schema";

const getRoute = createRoute({
  method: "get",
  path: "/v1/deployments",
  summary: "Get a deployment",
  tags: ["Deployments"],
  request: {
    query: GetDeploymentQuerySchema
  },
  responses: {
    200: {
      description: "Returns deployment info",
      content: {
        "application/json": {
          schema: GetDeploymentResponseSchema
        }
      }
    }
  }
});

const postRoute = createRoute({
  method: "post",
  path: "/v1/deployments",
  summary: "Create new deployment",
  tags: ["Deployments"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateDeploymentRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "Create deployment successfully",
      content: {
        "application/json": {
          schema: CreateDeploymentResponseSchema
        }
      }
    }
  }
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/v1/deployments/{dseq}",
  summary: "Close a deployment",
  tags: ["Deployments"],
  request: {
    params: CloseDeploymentParamsSchema
  },
  responses: {
    200: {
      description: "Deployment closed successfully",
      content: {
        "application/json": {
          schema: CloseDeploymentResponseSchema
        }
      }
    }
  }
});

const depositRoute = createRoute({
  method: "post",
  path: "/v1/deployments/{dseq}/deposit",
  summary: "Deposit into a deployment",
  tags: ["Deployments"],
  request: {
    params: DepositDeploymentParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: DepositDeploymentRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Deposit successful",
      content: {
        "application/json": {
          schema: DepositDeploymentResponseSchema
        }
      }
    }
  }
});

export const deploymentsRouter = new OpenApiHonoHandler();

deploymentsRouter.openapi(getRoute, async function routeGetDeployment(c) {
  const { dseq, userId } = c.req.valid("query");
  const result = await container.resolve(DeploymentController).findByDseqAndUserId(dseq, userId);
  return c.json(result, 200);
});

deploymentsRouter.openapi(postRoute, async function routeCreateDeployment(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentController).create(data);
  return c.json(result, 201);
});

deploymentsRouter.openapi(deleteRoute, async function routeCloseDeployment(c) {
  const { dseq } = c.req.valid("param");
  const result = await container.resolve(DeploymentController).close(dseq);
  return c.json(result, 200);
});

deploymentsRouter.openapi(depositRoute, async function routeDepositDeployment(c) {
  const { dseq } = c.req.valid("param");
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentController).deposit(dseq, data);
  return c.json(result, 200);
});
