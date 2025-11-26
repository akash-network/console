import { container } from "tsyringe";
import { z } from "zod";

import { createRoute } from "@src/core/services/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { DeploymentSettingController } from "@src/deployment/controllers/deployment-setting/deployment-setting.controller";
import {
  CreateDeploymentSettingRequestSchema,
  DeploymentSettingResponseSchema,
  FindDeploymentSettingParamsSchema,
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
