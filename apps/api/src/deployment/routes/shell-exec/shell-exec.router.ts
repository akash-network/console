import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { ShellExecController } from "@src/deployment/controllers/shell-exec/shell-exec.controller";
import {
  SHELL_EXEC_BODY_LIMIT_BYTES,
  ShellExecParamsSchema,
  ShellExecRequestSchema,
  ShellExecResponseSchema
} from "@src/deployment/http-schemas/shell-exec.schema";

export const shellExecRouter = new OpenApiHonoHandler();

const shellExecRoute = createRoute({
  method: "post",
  path: "/v1/deployments/{dseq}/leases/{gseq}/{oseq}/shell-exec",
  summary: "Execute a shell command in a deployment container",
  tags: ["Shell Exec"],
  security: SECURITY_BEARER_OR_API_KEY,
  // Explicit body limit derived from the schema field caps (see shell-exec.schema.ts)
  // so it can never drift from them. Measured on raw request bytes (pre-parse).
  bodyLimit: { maxSize: SHELL_EXEC_BODY_LIMIT_BYTES },
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
      description: "Forbidden - user does not own this deployment, or the provider authentication expired mid-execution"
    },
    404: {
      description: "Deployment or lease not found"
    },
    413: {
      description: "Request body exceeds the shell-exec body limit"
    },
    500: {
      description: "Internal server error (e.g., lease provider address missing)"
    },
    502: {
      description: "Provider proxy error (invalid provider host, connection failure, or provider-reported error)"
    },
    504: {
      description: "Command execution timed out"
    }
  }
});

shellExecRouter.openapi(shellExecRoute, async function routeShellExec(c) {
  const params = c.req.valid("param");
  const body = c.req.valid("json");
  const result = await container.resolve(ShellExecController).exec({ ...params, ...body });
  return c.json(result, 200);
});
