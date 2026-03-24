import { container } from "tsyringe";
import { z } from "zod";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { DeploymentSettingController } from "@src/deployment/controllers/deployment-setting/deployment-setting.controller";
import {
  CreateDeploymentSettingRequestSchema,
  CreateDeploymentSettingV2RequestSchema,
  DeploymentSettingResponseSchema,
  FindDeploymentSettingParamsSchema,
  FindDeploymentSettingV2ParamsSchema,
  FindDeploymentSettingV2QuerySchema,
  UpdateDeploymentSettingRequestSchema
} from "@src/deployment/http-schemas/deployment-setting.schema";

export const deploymentSettingRouter = new OpenApiHonoHandler();

const getRoute = createRoute({
  method: "get",
  path: "/v1/deployment-settings/{userId}/{dseq}",
  summary: "Get deployment settings by user ID and dseq",
  tags: ["Deployment Settings"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: FindDeploymentSettingParamsSchema
  },
  responses: {
    200: {
      description: "Returns deployment settings",
      content: {
        "application/json": {
          schema: DeploymentSettingResponseSchema
        }
      }
    },
    404: {
      description: "Deployment settings not found",
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
deploymentSettingRouter.openapi(getRoute, async function routeGetDeploymentSettings(c) {
  const params = c.req.valid("param");
  const result = await container.resolve(DeploymentSettingController).findOrCreateByUserIdAndDseq(params);

  return c.json(result, 200);
});

const postRoute = createRoute({
  method: "post",
  path: "/v1/deployment-settings",
  summary: "Create deployment settings",
  tags: ["Deployment Settings"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateDeploymentSettingRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "Deployment settings created successfully",
      content: {
        "application/json": {
          schema: DeploymentSettingResponseSchema
        }
      }
    }
  }
});
deploymentSettingRouter.openapi(postRoute, async function routeCreateDeploymentSettings(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentSettingController).create(data);
  return c.json(result, 201);
});

const patchRoute = createRoute({
  method: "patch",
  path: "/v1/deployment-settings/{userId}/{dseq}",
  summary: "Update deployment settings",
  tags: ["Deployment Settings"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: FindDeploymentSettingParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateDeploymentSettingRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Deployment settings updated successfully",
      content: {
        "application/json": {
          schema: DeploymentSettingResponseSchema
        }
      }
    },
    404: {
      description: "Deployment settings not found",
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
deploymentSettingRouter.openapi(patchRoute, async function routeUpdateDeploymentSettings(c) {
  const params = c.req.valid("param");
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentSettingController).upsert(params, data);
  return c.json(result, 200);
});

const getRouteV2 = createRoute({
  method: "get",
  path: "/v2/deployment-settings/{dseq}",
  summary: "Get deployment settings by dseq",
  tags: ["Deployment Settings"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: FindDeploymentSettingV2ParamsSchema,
    query: FindDeploymentSettingV2QuerySchema
  },
  responses: {
    200: {
      description: "Returns deployment settings",
      content: {
        "application/json": {
          schema: DeploymentSettingResponseSchema
        }
      }
    },
    404: {
      description: "Deployment settings not found",
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
deploymentSettingRouter.openapi(getRouteV2, async function routeGetDeploymentSettingsV2(c) {
  const result = await container.resolve(DeploymentSettingController).findOrCreateV2({ ...c.req.valid("param"), ...c.req.valid("query") });
  return c.json(result, 200);
});

const postRouteV2 = createRoute({
  method: "post",
  path: "/v2/deployment-settings",
  summary: "Create deployment settings",
  tags: ["Deployment Settings"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateDeploymentSettingV2RequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "Deployment settings created successfully",
      content: {
        "application/json": {
          schema: DeploymentSettingResponseSchema
        }
      }
    }
  }
});
deploymentSettingRouter.openapi(postRouteV2, async function routeCreateDeploymentSettingsV2(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentSettingController).createV2(data);
  return c.json(result, 201);
});

const patchRouteV2 = createRoute({
  method: "patch",
  path: "/v2/deployment-settings/{dseq}",
  summary: "Update deployment settings",
  tags: ["Deployment Settings"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: FindDeploymentSettingV2ParamsSchema,
    query: FindDeploymentSettingV2QuerySchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateDeploymentSettingRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Deployment settings updated successfully",
      content: {
        "application/json": {
          schema: DeploymentSettingResponseSchema
        }
      }
    },
    404: {
      description: "Deployment settings not found",
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
deploymentSettingRouter.openapi(patchRouteV2, async function routeUpdateDeploymentSettingsV2(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentSettingController).upsertV2({ ...c.req.valid("param"), ...c.req.valid("query"), ...data });
  return c.json(result, 200);
});
