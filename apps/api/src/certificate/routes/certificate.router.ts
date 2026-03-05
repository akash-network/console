import { z } from "@hono/zod-openapi";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const certificateRouter = new OpenApiHonoHandler();

const createCertificateRoute = createRoute({
  method: "post",
  path: "/v1/certificates",
  summary: "Create certificate",
  tags: ["Certificate"],
  security: SECURITY_BEARER_OR_API_KEY,
  responses: {
    400: {
      description: "This endpoint has been removed. mTLS certificates are no longer required as identity is now verified via API key.",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string()
          })
        }
      }
    }
  }
});
certificateRouter.openapi(createCertificateRoute, async function routeCreateCertificate(c) {
  const result = { error: "This endpoint has been removed. mTLS certificates are no longer required as identity is now verified via API key." };
  return c.json(result, 400);
});
