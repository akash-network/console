import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { DeploymentNameParamsSchema, DeploymentNameResponseSchema } from "@src/deployment/http-schemas/deployment-name.schema";
import { DeploymentNameService } from "@src/deployment/services/deployment-name/deployment-name.service";
import { requireInternalToken } from "@src/middlewares/internal-token/internal-token.middleware";

export const internalDeploymentNameRouter = new OpenApiHonoHandler();

const getDeploymentNameRoute = createRoute({
  method: "get",
  path: "/deployment-names/{owner}/{dseq}",
  operationId: "getDeploymentName",
  summary: "The name Console holds for a deployment, so the emails sent about it can call it by that name",
  security: SECURITY_NONE,
  hiddenInOpenApiDocs: true,
  middleware: [requireInternalToken],
  request: {
    params: DeploymentNameParamsSchema
  },
  responses: {
    200: {
      description: "The deployment's name, null when Console holds none for it",
      content: { "application/json": { schema: DeploymentNameResponseSchema } }
    },
    400: { description: "Invalid owner address or dseq" },
    401: { description: "Missing or wrong internal token" }
  }
});

internalDeploymentNameRouter.openapi(getDeploymentNameRoute, async function routeGetDeploymentName(c) {
  const name = await container.resolve(DeploymentNameService).findName(c.req.valid("param"));

  return c.json({ name }, 200);
});
