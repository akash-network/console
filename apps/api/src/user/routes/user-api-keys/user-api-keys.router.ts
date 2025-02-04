import { createRoute as createOpenApiRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { UserApiKeyController } from "@src/user/controllers/user-api-keys/user-api-keys.controller";
import {
  CreateUserApiKeyRequestSchema,
  FindUserApiKeyParamsSchema,
  UpdateUserApiKeyRequestSchema,
  UserApiKeyResponseSchema
} from "@src/user/http-schemas/user-api-key.schema";

const listRoute = createOpenApiRoute({
  method: "get",
  path: "/v1/users/api-keys",
  summary: "List all API keys",
  tags: ["User API Keys"],
  responses: {
    200: {
      description: "Returns list of API keys",
      content: {
        "application/json": {
          schema: z.array(UserApiKeyResponseSchema)
        }
      }
    }
  }
});

const getRoute = createOpenApiRoute({
  method: "get",
  path: "/v1/users/api-keys/{id}",
  summary: "Get API key by ID",
  tags: ["User API Keys"],
  request: {
    params: FindUserApiKeyParamsSchema
  },
  responses: {
    200: {
      description: "Returns API key details",
      content: {
        "application/json": {
          schema: UserApiKeyResponseSchema
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

const postRoute = createOpenApiRoute({
  method: "post",
  path: "/v1/users/api-keys",
  summary: "Create new API key",
  tags: ["User API Keys"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateUserApiKeyRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "API key created successfully",
      content: {
        "application/json": {
          schema: UserApiKeyResponseSchema
        }
      }
    }
  }
});

const patchRoute = createOpenApiRoute({
  method: "patch",
  path: "/v1/users/api-keys/{id}",
  summary: "Update API key",
  tags: ["User API Keys"],
  request: {
    params: FindUserApiKeyParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateUserApiKeyRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "API key updated successfully",
      content: {
        "application/json": {
          schema: UserApiKeyResponseSchema
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

const deleteRoute = createOpenApiRoute({
  method: "delete",
  path: "/v1/users/api-keys/{id}",
  summary: "Delete API key",
  tags: ["User API Keys"],
  request: {
    params: FindUserApiKeyParamsSchema
  },
  responses: {
    200: {
      description: "API key deleted successfully",
      content: {
        "application/json": {
          schema: UserApiKeyResponseSchema
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

export const userApiKeysRouter = new OpenApiHonoHandler();

userApiKeysRouter.openapi(listRoute, async function routeListApiKeys(c) {
  const result = await container.resolve(UserApiKeyController).findAll();
  return c.json(
    result.map(r => r.data),
    200
  );
});

userApiKeysRouter.openapi(getRoute, async function routeGetApiKey(c) {
  const { id } = c.req.valid("param");
  const result = await container.resolve(UserApiKeyController).findById(id);
  return c.json(result.data, 200);
});

userApiKeysRouter.openapi(postRoute, async function routeCreateApiKey(c) {
  const { data } = c.req.valid("json");
  const userId = "user-id-from-auth-context";
  const result = await container.resolve(UserApiKeyController).create(userId, data);
  return c.json(result.data, 201);
});

userApiKeysRouter.openapi(patchRoute, async function routeUpdateApiKey(c) {
  const { id } = c.req.valid("param");
  const { data } = c.req.valid("json");
  const result = await container.resolve(UserApiKeyController).update(id, data);
  return c.json(result.data, 200);
});

userApiKeysRouter.openapi(deleteRoute, async function routeDeleteApiKey(c) {
  const { id } = c.req.valid("param");
  const result = await container.resolve(UserApiKeyController).delete(id);
  return c.json(result.data, 200);
});
