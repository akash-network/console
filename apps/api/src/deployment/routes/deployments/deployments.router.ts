import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import { CreateDeploymentRequestSchema, CreateDeploymentResponseSchema, GetDeploymentQuerySchema, GetDeploymentResponseSchema } from "@src/deployment/http-schemas/deployment.schema";

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
      description: "API key created successfully",
      content: {
        "application/json": {
          schema: CreateDeploymentResponseSchema
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
