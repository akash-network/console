import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { ShellExecController } from "@src/deployment/controllers/shell-exec/shell-exec.controller";
import { ShellExecParamsSchema, ShellExecRequestSchema, ShellExecResponseSchema } from "@src/deployment/http-schemas/shell-exec.schema";

export const shellExecRouter = new OpenApiHonoHandler();

const shellExecRoute = createRoute({
  method: "post",
  path: "/v1/deployments/{dseq}/leases/{gseq}/{oseq}/shell-exec",
  summary: "Execute a shell command in a deployment container",
  tags: ["Shell Exec"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    params: ShellExecParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: ShellExecRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Command executed successfully",
      content: {
        "application/json": {
          schema: ShellExecResponseSchema
        }
      }
    },
    400: {
      description: "Invalid request (e.g., lease not active)"
    },
    401: {
      description: "Unauthorized"
    },
    403: {
      description: "Forbidden - user does not own this deployment"
    },
    404: {
      description: "Deployment or lease not found"
    },
    502: {
      description: "Provider proxy error"
    }
  }
});

shellExecRouter.openapi(shellExecRoute, async function routeShellExec(c) {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await container.resolve(ShellExecController).exec({ ...params, ...body });
  return c.json(result, 200);
});
