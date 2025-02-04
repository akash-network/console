import { createRoute } from "@hono/zod-openapi";
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

const listRoute = createRoute({
  method: "get",
  path: "/v1/users/{userId}/api-keys",
  summary: "List all API keys",
  tags: ["User API Keys"],
  request: {
    params: z.object({
      userId: z.string().uuid()
    })
  },
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

const getRoute = createRoute({
  method: "get",
  path: "/v1/users/{userId}/api-keys/{id}",
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

const postRoute = createRoute({
  method: "post",
  path: "/v1/users/{userId}/api-keys",
  summary: "Create new API key",
  tags: ["User API Keys"],
  request: {
    params: z.object({
      userId: z.string().uuid()
    }),
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

const patchRoute = createRoute({
  method: "patch",
  path: "/v1/users/{userId}/api-keys/{id}",
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

const deleteRoute = createRoute({
  method: "delete",
  path: "/v1/users/{userId}/api-keys/{id}",
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
  const { userId } = c.req.valid("param");
  const result = await container.resolve(UserApiKeyController).findAll(userId);
  return c.json(
    result.map(r => r.data),
    200
  );
});

userApiKeysRouter.openapi(getRoute, async function routeGetApiKey(c) {
  const { id, userId } = c.req.valid("param");
  const result = await container.resolve(UserApiKeyController).findById(id, userId);
  return c.json(result.data, 200);
});

userApiKeysRouter.openapi(postRoute, async function routeCreateApiKey(c) {
  const { userId } = c.req.valid("param");
  const { data } = c.req.valid("json");
  const result = await container.resolve(UserApiKeyController).create(userId, data);
  return c.json(result.data, 201);
});

userApiKeysRouter.openapi(patchRoute, async function routeUpdateApiKey(c) {
  const { id, userId } = c.req.valid("param");
  const { data } = c.req.valid("json");
  const result = await container.resolve(UserApiKeyController).update(id, userId, data);
  return c.json(result.data, 200);
});

userApiKeysRouter.openapi(deleteRoute, async function routeDeleteApiKey(c) {
  const { id, userId } = c.req.valid("param");
  const result = await container.resolve(UserApiKeyController).delete(id, userId);
  return c.json(result.data, 200);
});
