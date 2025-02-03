import { createRoute as createOpenApiRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { DeploymentSettingController } from "@src/deployment/controllers/deployment-setting/deployment-setting.controller";
import {
  CreateDeploymentSettingRequestSchema,
  DeploymentSettingResponseSchema,
  FindDeploymentSettingParamsSchema,
  UpdateDeploymentSettingRequestSchema
} from "@src/deployment/http-schemas/deployment-setting.schema";

const getRoute = createOpenApiRoute({
  method: "get",
  path: "/v1/deployment-settings/{userId}/{dseq}",
  summary: "Get deployment settings by user ID and dseq",
  tags: ["Deployment Settings"],
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

const postRoute = createOpenApiRoute({
  method: "post",
  path: "/v1/deployment-settings",
  summary: "Create deployment settings",
  tags: ["Deployment Settings"],
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

const patchRoute = createOpenApiRoute({
  method: "patch",
  path: "/v1/deployment-settings/{userId}/{dseq}",
  summary: "Update deployment settings",
  tags: ["Deployment Settings"],
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

export const deploymentSettingRouter = new OpenApiHonoHandler();

deploymentSettingRouter.openapi(getRoute, async function routeGetDeploymentSettings(c) {
  const params = c.req.valid("param");
  const result = await container.resolve(DeploymentSettingController).findByUserIdAndDseq(params);

  return c.json(result, 200);
});

deploymentSettingRouter.openapi(postRoute, async function routeCreateDeploymentSettings(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentSettingController).create(data);
  return c.json(result, 201);
});

deploymentSettingRouter.openapi(patchRoute, async function routeUpdateDeploymentSettings(c) {
  const params = c.req.valid("param");
  const { data } = c.req.valid("json");
  const result = await container.resolve(DeploymentSettingController).update(params, data);
  return c.json(result, 200);
});
