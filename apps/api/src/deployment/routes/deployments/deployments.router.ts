import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { DeploymentController } from "@src/deployment/controllers/deployment/deployment.controller";
import {
  CloseDeploymentParamsSchema,
  CloseDeploymentResponseSchema,
  CreateDeploymentRequestSchema,
  CreateDeploymentResponseSchema,
  DepositDeploymentRequestSchema,
  DepositDeploymentResponseSchema,
  GetDeploymentByOwnerDseqParamsSchema,
  GetDeploymentByOwnerDseqResponseSchema,
  GetDeploymentParamsSchema,
  GetDeploymentResponseSchema,
  ListDeploymentsQuerySchema,
  ListDeploymentsResponseSchema,
  ListWithResourcesParamsSchema,
  ListWithResourcesQuerySchema,
  ListWithResourcesResponseSchema,
  UpdateDeploymentRequestSchema,
  UpdateDeploymentResponseSchema
} from "@src/deployment/http-schemas/deployment.schema";
import {
  FallbackDeploymentInfoQuerySchema,
  FallbackDeploymentInfoResponseSchema,
  FallbackDeploymentListQuerySchema,
  FallbackDeploymentListResponseSchema
} from "@src/deployment/http-schemas/deployment-rpc.schema";
import { FallbackDeploymentReaderService } from "@src/deployment/services/fallback-deployment-reader/fallback-deployment-reader.service";

const getRoute = createRoute({
  method: "get",
  path: "/v1/deployments/{dseq}",
  summary: "Get a deployment",
  tags: ["Deployments"],
  request: {
    params: GetDeploymentParamsSchema
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
  path: "/v1/deposit-deployment",
  summary: "Deposit into a deployment",
  tags: ["Deployments"],
  request: {
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

const updateRoute = createRoute({
  method: "put",
  path: "/v1/deployments/{dseq}",
  summary: "Update a deployment",
  tags: ["Deployments"],
  request: {
    params: CloseDeploymentParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateDeploymentRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Deployment updated successfully",
      content: {
        "application/json": {
          schema: UpdateDeploymentResponseSchema
        }
      }
    }
  }
});

const listRoute = createRoute({
  method: "get",
  path: "/v1/deployments",
  summary: "List deployments with pagination and filtering",
  tags: ["Deployments"],
  request: {
    query: ListDeploymentsQuerySchema
  },
  responses: {
    200: {
      description: "Returns paginated list of deployments",
      content: {
        "application/json": {
          schema: ListDeploymentsResponseSchema
        }
      }
    }
  }
});

const listWithResourcesRoute = createRoute({
  method: "get",
  path: "/v1/addresses/{address}/deployments/{skip}/{limit}",
  summary: "Get a list of deployments by owner address.",
  tags: ["Addresses", "Deployments"],
  request: {
    params: ListWithResourcesParamsSchema,
    query: ListWithResourcesQuerySchema
  },
  responses: {
    200: {
      description: "Returns deployment list",
      content: {
        "application/json": {
          schema: ListWithResourcesResponseSchema
        }
      }
    },
    400: {
      description: "Invalid address"
    }
  }
});

const getByOwnerAndDseqRoute = createRoute({
  method: "get",
  path: "/v1/deployment/{owner}/{dseq}",
  summary: "Get deployment details",
  tags: ["Deployments"],
  request: {
    params: GetDeploymentByOwnerDseqParamsSchema
  },
  responses: {
    200: {
      description: "Returns deployment details",
      content: {
        "application/json": {
          schema: GetDeploymentByOwnerDseqResponseSchema
        }
      }
    },
    400: {
      description: "Invalid address or dseq"
    },
    404: {
      description: "Deployment not found"
    }
  }
});

const fallbackListRoute = createRoute({
  method: "get",
  path: "/akash/deployment/{version}/deployments/list",
  summary: "List deployments (database fallback)",
  tags: ["Deployments"],
  request: {
    query: FallbackDeploymentListQuerySchema
  },
  responses: {
    200: {
      description: "Returns paginated list of deployments from database",
      content: {
        "application/json": {
          schema: FallbackDeploymentListResponseSchema
        }
      }
    }
  }
});

const fallbackInfoRoute = createRoute({
  method: "get",
  path: "/akash/deployment/{version}/deployments/info",
  summary: "Get deployment info (database fallback)",
  tags: ["Deployments"],
  request: {
    query: FallbackDeploymentInfoQuerySchema
  },
  responses: {
    200: {
      description: "Returns deployment info from database",
      content: {
        "application/json": {
          schema: FallbackDeploymentInfoResponseSchema
        }
      }
    },
    404: {
      description: "Deployment not found"
    }
  }
});

export const deploymentsRouter = new OpenApiHonoHandler();

deploymentsRouter.openapi(getRoute, async function routeGetDeployment(c) {
  const { dseq } = c.req.valid("param");
  const result = await container.resolve(DeploymentController).findByDseq(dseq);
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
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentController).deposit(data);
  return c.json(result, 200);
});

deploymentsRouter.openapi(updateRoute, async function routeUpdateDeployment(c) {
  const { dseq } = c.req.valid("param");
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentController).update(dseq, data);
  return c.json(result, 200);
});

deploymentsRouter.openapi(listRoute, async function routeListDeployments(c) {
  const { skip, limit } = c.req.valid("query");
  const result = await container.resolve(DeploymentController).list({ skip, limit });
  return c.json(result, 200);
});

deploymentsRouter.openapi(listWithResourcesRoute, async function routeListDeploymentsWithResources(c) {
  const { address, skip, limit } = c.req.valid("param");
  const { status, reverseSorting } = c.req.valid("query");
  const result = await container.resolve(DeploymentController).listWithResources({
    address,
    status,
    skip,
    limit,
    reverseSorting
  });

  return c.json(result, 200);
});

deploymentsRouter.openapi(getByOwnerAndDseqRoute, async function routeGetDeploymentByOwnerAndDseq(c) {
  const { owner, dseq } = c.req.valid("param");
  const deployment = await container.resolve(DeploymentController).getByOwnerAndDseq(owner, dseq);

  if (deployment) {
    return c.json(deployment);
  } else {
    return c.json({ error: "NotFoundError", message: "Deployment Not Found" }, { status: 404 });
  }
});

deploymentsRouter.openapi(fallbackListRoute, async function routeFallbackListDeployments(c) {
  const query = c.req.valid("query");
  const deploymentService = container.resolve(FallbackDeploymentReaderService);

  const result = await deploymentService.findAll({
    owner: query["filters.owner"],
    state: query["filters.state"],
    skip: query["pagination.offset"],
    limit: query["pagination.limit"],
    key: query["pagination.key"],
    countTotal: query["pagination.count_total"],
    reverse: query["pagination.reverse"]
  });

  return c.json(result, 200);
});

deploymentsRouter.openapi(fallbackInfoRoute, async function routeFallbackDeploymentInfo(c) {
  const query = c.req.valid("query");
  const deploymentService = container.resolve(FallbackDeploymentReaderService);

  const result = await deploymentService.findByOwnerAndDseq(query["id.owner"], query["id.dseq"]);

  if (result) {
    return c.json(result, 200);
  } else {
    return c.json(
      {
        code: 5,
        message: "deployment not found",
        details: []
      },
      404
    );
  }
});
