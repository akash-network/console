import { z } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY, SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { CREATE_DEPLOYMENT_BODY_LIMIT_BYTES } from "@src/deployment/config/sdl-secrets.config";
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
  GetWeeklyDeploymentCostResponseSchema,
  ListDeploymentNamesQuerySchema,
  ListDeploymentNamesResponseSchema,
  ListDeploymentsQuerySchema,
  ListDeploymentsResponseSchema,
  ListWithResourcesParamsSchema,
  ListWithResourcesQuerySchema,
  ListWithResourcesResponseSchema,
  PatchDeploymentParamsSchema,
  PatchDeploymentRequestSchema,
  PatchDeploymentResponseSchema,
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

export const deploymentsRouter = new OpenApiHonoHandler();

/** What `HonoErrorHandlerService` actually returns for a refused request, rather than the `message` alone the first draft of this route declared. */
const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  code: z.string(),
  type: z.string()
});

const getRoute = createRoute({
  method: "get",
  path: "/v1/deployments/{dseq}",
  summary: "Get a deployment",
  operationId: "getDeployment",
  tags: ["Deployments"],
  security: SECURITY_BEARER_OR_API_KEY,
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
deploymentsRouter.openapi(getRoute, async function routeGetDeployment(c) {
  const { dseq } = c.req.valid("param");
  const result = await container.resolve(DeploymentController).findByDseq(dseq);
  return c.json(result, 200);
});

const postRoute = createRoute({
  method: "post",
  path: "/v1/deployments",
  summary: "Create new deployment",
  operationId: "createDeployment",
  tags: ["Deployments"],
  security: SECURITY_BEARER_OR_API_KEY,
  /** The only route that can carry a seal, sized so the stated secret limits are reachable rather than shadowed by the default allowance. */
  bodyLimit: { maxSize: CREATE_DEPLOYMENT_BODY_LIMIT_BYTES },
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
    },
    400: {
      description:
        "The SDL leaves a secret reference with no value from either `sealedSecrets` or the deployment named by `inheritSecretsFrom`, supplies a name no service references, would carry more secrets than one deployment may hold, or carries a `sealedSecrets` value that is malformed, tampered with, expired or not a flat object of string values",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    403: {
      description: "The `sealedSecrets` value was sealed for a different user, or bound to a different SDL than the one submitted",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description: "No deployment of yours matches `inheritSecretsFrom`. Deliberately says nothing about whether that deployment exists",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    409: {
      description:
        "Either the `sealedSecrets` value was sealed to a key the console no longer holds — refetch `GET /v1/sdl-secrets-context` and seal again — or, with `code` `inherited_secrets_unreadable`, the secrets recorded for the deployment named by `inheritSecretsFrom` can no longer be decrypted. The second is permanent rather than transient, so a retry cannot help; supply the values in `sealedSecrets` instead",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    503: {
      description: "The key management service is temporarily unreachable. Transient and worth retrying, unlike the 409 above",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});
deploymentsRouter.openapi(postRoute, async function routeCreateDeployment(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentController).create(data);
  return c.json(result, 201);
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/v1/deployments/{dseq}",
  summary: "Close a deployment",
  operationId: "closeDeployment",
  tags: ["Deployments"],
  security: SECURITY_BEARER_OR_API_KEY,
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
deploymentsRouter.openapi(deleteRoute, async function routeCloseDeployment(c) {
  const { dseq } = c.req.valid("param");
  const result = await container.resolve(DeploymentController).close(dseq);
  return c.json(result, 200);
});

const depositRoute = createRoute({
  method: "post",
  path: "/v1/deposit-deployment",
  summary: "Deposit into a deployment (deprecated)",
  description: "Deprecated. Managed deployments are funded automatically; this endpoint will be removed in a future release.",
  operationId: "depositDeployment",
  deprecated: true,
  tags: ["Deployments"],
  security: SECURITY_BEARER_OR_API_KEY,
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
deploymentsRouter.openapi(depositRoute, async function routeDepositDeployment(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentController).deposit(data);
  return c.json(result, 200);
});

const updateRoute = createRoute({
  method: "put",
  path: "/v1/deployments/{dseq}",
  summary: "Update a deployment (deprecated)",
  description:
    "Deprecated. Resubmits the whole SDL, so rotating one secret means re-supplying every other value the document carries, and the console cannot return a stored value for you to resupply. Use PATCH /v1/deployments/{dseq} instead. This endpoint will be removed in a future release.",
  operationId: "updateDeployment",
  deprecated: true,
  tags: ["Deployments"],
  security: SECURITY_BEARER_OR_API_KEY,
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
deploymentsRouter.openapi(updateRoute, async function routeUpdateDeployment(c) {
  const { dseq } = c.req.valid("param");
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentController).update(dseq, data);
  return c.json(result, 200);
});

const patchRoute = createRoute({
  method: "patch",
  path: "/v1/deployments/{dseq}",
  summary: "Patch a deployment",
  description:
    "Patches the SDL the console stored for this deployment, or renames the deployment, or both; the SDL is never accepted from the request. Only the services named are touched. A `name` on its own touches no definition, so it renames a deployment the console holds no SDL for and neither broadcasts nor pushes a manifest. A patched environment variable is re-appended to its service's env list, so the order shown by GET may differ afterwards. A replaced secret takes effect when the deployment is next updated on chain, not in the workload already running. The definition is recorded before the chain transaction is broadcast, so a broadcast that fails leaves the console describing a manifest version the chain never saw. Re-sending the identical request repairs that: it recomputes the same manifest version, is accepted rather than refused, and goes on to broadcast and push the manifest.",
  operationId: "patchDeployment",
  tags: ["Deployments"],
  security: SECURITY_BEARER_OR_API_KEY,
  /** Sized like the create route, because a patch may carry a seal and the default allowance would shadow the stated secret limits. */
  bodyLimit: { maxSize: CREATE_DEPLOYMENT_BODY_LIMIT_BYTES },
  request: {
    params: PatchDeploymentParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: PatchDeploymentRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Deployment patched successfully",
      content: {
        "application/json": {
          schema: PatchDeploymentResponseSchema
        }
      }
    },
    400: {
      description:
        "The patch names a service, port or volume the stored SDL does not declare, supplies a secret name it does not reference, or leaves a reference with no value",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    404: {
      description:
        "No SDL is recorded for this deployment, so there is nothing to patch. A rename answers this only when the chain holds no such deployment for the caller, since it needs no recorded SDL",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    409: {
      description:
        "The deployment definition changed between this patch reading it and writing it. A patch naming no `ifManifestVersion` is guarded on the version it read, so a concurrent patch produces this too. Re-sending the identical patch is not a conflict, because the version it recomputes is the one the row already holds",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    500: {
      description:
        "The deployment's stored state could not be read: `code` is `stored_secrets_unreadable` when the sealed secrets would not open and `stored_sdl_unreadable` when the recorded SDL would not parse. Both are permanent rather than transient, so a retry cannot help, and both leave the stored token untouched. A 500 carrying any other `code` is an unexpected failure and promises neither of those things",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    },
    503: {
      description: "The key management service is temporarily unreachable. Transient and worth retrying, unlike the 500 above",
      content: {
        "application/json": {
          schema: ErrorResponseSchema
        }
      }
    }
  }
});
deploymentsRouter.openapi(patchRoute, async function routePatchDeployment(c) {
  const { dseq } = c.req.valid("param");
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentController).patch(dseq, data);
  return c.json(result, 200);
});

const listRoute = createRoute({
  method: "get",
  path: "/v1/deployments",
  summary: "List deployments with pagination and filtering",
  operationId: "listDeployments",
  tags: ["Deployments"],
  security: SECURITY_BEARER_OR_API_KEY,
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
deploymentsRouter.openapi(listRoute, async function routeListDeployments(c) {
  const { skip, limit } = c.req.valid("query");
  const result = await container.resolve(DeploymentController).list({ skip, limit });
  return c.json(result, 200);
});

const listNamesRoute = createRoute({
  method: "get",
  path: "/v1/deployment-names",
  summary: "List the names of the caller's deployments",
  description:
    "The names the console recorded for this caller's deployments, newest first. Answers for closed deployments too, unlike GET /v1/deployments, and costs no chain read: a client resolving names for a list it already holds needs no dseqs to ask.",
  operationId: "listDeploymentNames",
  tags: ["Deployments"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    query: ListDeploymentNamesQuerySchema
  },
  responses: {
    200: {
      description: "Returns one page of deployment names",
      content: {
        "application/json": {
          schema: ListDeploymentNamesResponseSchema
        }
      }
    }
  }
});
deploymentsRouter.openapi(listNamesRoute, async function routeListDeploymentNames(c) {
  const { skip, limit } = c.req.valid("query");
  const result = await container.resolve(DeploymentController).listNames({ skip, limit });
  return c.json(result, 200);
});

const listWithResourcesRoute = createRoute({
  method: "get",
  path: "/v1/addresses/{address}/deployments/{skip}/{limit}",
  summary: "Get a list of deployments by owner address.",
  tags: ["Addresses", "Deployments"],
  security: SECURITY_NONE,
  cache: { maxAge: 6, staleWhileRevalidate: 30 },
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

const getByOwnerAndDseqRoute = createRoute({
  method: "get",
  path: "/v1/deployment/{owner}/{dseq}",
  summary: "Get deployment details",
  tags: ["Deployments"],
  security: SECURITY_NONE,
  cache: { maxAge: 30, staleWhileRevalidate: 60 },
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
deploymentsRouter.openapi(getByOwnerAndDseqRoute, async function routeGetDeploymentByOwnerAndDseq(c) {
  const { owner, dseq } = c.req.valid("param");
  const deployment = await container.resolve(DeploymentController).getByOwnerAndDseq(owner, dseq);

  if (deployment) {
    return c.json(deployment);
  } else {
    return c.json({ error: "NotFoundError", message: "Deployment Not Found" }, { status: 404 });
  }
});

const fallbackListRoute = createRoute({
  method: "get",
  path: "/akash/deployment/{version}/deployments/list",
  summary: "List deployments (database fallback)",
  tags: ["Deployments"],
  security: SECURITY_NONE,
  cache: { maxAge: 10, staleWhileRevalidate: 30 },
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

const fallbackInfoRoute = createRoute({
  method: "get",
  path: "/akash/deployment/{version}/deployments/info",
  summary: "Get deployment info (database fallback)",
  tags: ["Deployments"],
  security: SECURITY_NONE,
  cache: { maxAge: 10, staleWhileRevalidate: 30 },
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

const getWeeklyDeploymentCostRoute = createRoute({
  method: "get",
  path: "/v1/weekly-cost",
  summary: "Get weekly deployment cost",
  tags: ["Deployments"],
  security: SECURITY_BEARER_OR_API_KEY,
  responses: {
    200: {
      description: "Returns weekly cost for all deployments with auto top-up enabled",
      content: {
        "application/json": {
          schema: GetWeeklyDeploymentCostResponseSchema
        }
      }
    }
  }
});
deploymentsRouter.openapi(getWeeklyDeploymentCostRoute, async function routeGetWeeklyDeploymentCost(c) {
  const result = await container.resolve(DeploymentController).getWeeklyDeploymentCost();
  return c.json(result, 200);
});
