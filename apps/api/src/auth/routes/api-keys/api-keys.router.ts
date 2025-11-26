import { container } from "tsyringe";
import { z } from "zod";

import { ApiKeyController } from "@src/auth/controllers/api-key/api-key.controller";
import {
  ApiKeyHiddenResponseSchema,
  ApiKeyVisibleResponseSchema,
  CreateApiKeyRequestSchema,
  FindApiKeyParamsSchema,
  UpdateApiKeyRequestSchema
} from "@src/auth/http-schemas/api-key.schema";
import { ListApiKeysResponseSchema } from "@src/auth/http-schemas/api-key.schema";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const apiKeysRouter = new OpenApiHonoHandler();

const listRoute = createRoute({
  method: "get",
  path: "/v1/api-keys",
  summary: "List all API keys",
  tags: ["API Keys"],
  security: SECURITY_BEARER_OR_API_KEY,
  responses: {
    200: {
      description: "Returns list of API keys",
      content: {
        "application/json": {
          schema: ListApiKeysResponseSchema
        }
      }
    }
  }
});
apiKeysRouter.openapi(listRoute, async function routeListApiKeys(c) {
  const result = await container.resolve(ApiKeyController).findAll();
  return c.json(result, 200);
});

const getRoute = createRoute({
  method: "get",
  path: "/v1/api-keys/{id}",
  summary: "Get API key by ID",
  tags: ["API Keys"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: FindApiKeyParamsSchema
  },
  responses: {
    200: {
      description: "Returns API key details",
      content: {
        "application/json": {
          schema: ApiKeyHiddenResponseSchema
        }
      }
    },
    404: {
      description: "API key not found",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string()
          })
        }
      }
    }
  }
});
apiKeysRouter.openapi(getRoute, async function routeGetApiKey(c) {
  const { id } = c.req.valid("param");
  const result = await container.resolve(ApiKeyController).findById(id);
  return c.json(result, 200);
});

const postRoute = createRoute({
  method: "post",
  path: "/v1/api-keys",
  summary: "Create new API key",
  tags: ["API Keys"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateApiKeyRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "API key created successfully",
      content: {
        "application/json": {
          schema: ApiKeyVisibleResponseSchema
        }
      }
    }
  }
});
apiKeysRouter.openapi(postRoute, async function routeCreateApiKey(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(ApiKeyController).create(data);
  return c.json(result, 201);
});

const patchRoute = createRoute({
  method: "patch",
  path: "/v1/api-keys/{id}",
  summary: "Update API key",
  tags: ["API Keys"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: FindApiKeyParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateApiKeyRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "API key updated successfully",
      content: {
        "application/json": {
          schema: ApiKeyHiddenResponseSchema
        }
      }
    },
    404: {
      description: "API key not found",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string()
          })
        }
      }
    }
  }
});
apiKeysRouter.openapi(patchRoute, async function routeUpdateApiKey(c) {
  const { id } = c.req.valid("param");
  const { data } = c.req.valid("json");
  const result = await container.resolve(ApiKeyController).update(id, data);
  return c.json(result, 200);
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/v1/api-keys/{id}",
  summary: "Delete API key",
  tags: ["API Keys"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: FindApiKeyParamsSchema
  },
  responses: {
    204: {
      description: "API key deleted successfully"
    },
    404: {
      description: "API key not found",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string()
          })
        }
      }
    }
  }
});
apiKeysRouter.openapi(deleteRoute, async function routeDeleteApiKey(c) {
  const { id } = c.req.valid("param");
  await container.resolve(ApiKeyController).delete(id);
  return c.body(null, 204);
});
